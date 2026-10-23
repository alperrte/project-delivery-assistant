package com.pda.meeting.internal;

import com.pda.meeting.*;
import com.pda.project.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import static com.pda.meeting.internal.MeetingDtos.*;

@Service @Transactional
public class MeetingService {
    final MeetingRepository meetings;
    final MeetingParticipantRepository participants;
    final MeetingInviteRepository invites;
    final MeetingChatRepository chats;
    final MeetingChatReactionRepository reactions;
    final MeetingAuditRepository audits;
    final MeetingHiddenRepository hidden;
    final ProjectAccess projects;
    final MeetingMediaPort media;
    final MeetingPolicy policy;
    final ApplicationEventPublisher events;
    final Clock clock;
    private static final SecureRandom RANDOM=new SecureRandom();
    /** The only icon names a meeting may carry (mirrors the V55 CHECK constraint and the frontend picker). */
    public static final Set<String> ICONS=Set.of("video","users","calendar","presentation","code","laptop","lightbulb","target","briefcase","graduation-cap","clipboard-list","message-square");
    /** Which of the caller's cleared (hidden) meetings a listing returns. */
    public enum HiddenMode { EXCLUDE, INCLUDE, ONLY }
    public MeetingService(MeetingRepository meetings,MeetingParticipantRepository participants,MeetingInviteRepository invites,
        MeetingChatRepository chats,MeetingChatReactionRepository reactions,MeetingAuditRepository audits,MeetingHiddenRepository hidden,ProjectAccess projects,MeetingMediaPort media,
        MeetingPolicy policy,ApplicationEventPublisher events,Clock clock) {
        this.meetings=meetings; this.participants=participants; this.invites=invites; this.chats=chats; this.reactions=reactions;
        this.audits=audits; this.hidden=hidden; this.projects=projects; this.media=media; this.policy=policy; this.events=events; this.clock=clock;
    }
    void enabled() { if(!policy.isEnabled()) throw error(503,"MEETING_DISABLED"); }
    void member(UUID project,UUID actor) {
        enabled(); if(actor==null||!projects.isMember(project,actor)) throw error(403,"MEETING_FORBIDDEN");
    }
    boolean manager(Meeting m,UUID actor) { return projects.rolesForUserInProject(m.projectId,actor).contains("PROJECT_MANAGER"); }
    void moderate(Meeting m,UUID actor) { member(m.projectId,actor); if(!manager(m,actor)) throw error(403,"MEETING_MANAGER_REQUIRED"); }
    /** Ending a meeting for everyone belongs to the user recorded as its organizer at creation, never to a role: a project manager who did not create it is refused. Access (active membership) is still required, so an owner who left the project cannot end it either. */
    void owner(Meeting m,UUID actor) { member(m.projectId,actor); if(!actor.equals(m.organizerId)) throw error(403,"MEETING_OWNER_REQUIRED"); }
    void edit(Meeting m,UUID actor) { if(!manager(m,actor)&&!m.organizerId.equals(actor)) throw error(403,"MEETING_FORBIDDEN"); }
    Meeting load(UUID project,UUID id,UUID actor) {
        member(project,actor); projects.lockMembershipContext(project); member(project,actor); Meeting m=locked(id); if(!m.projectId.equals(project)) throw error(404,"MEETING_NOT_FOUND"); return m;
    }
    public Meeting locked(UUID id) { return meetings.lock(id).orElseThrow(()->error(404,"MEETING_NOT_FOUND")); }
    public View create(UUID project,UUID actor,Command requested) {
        member(project,actor); projects.lockMembershipContext(project); member(project,actor);
        // "Start now" takes its start from this server clock; the client clock is only a hint, and one that runs slow used to be refused as "in the past".
        Command c=requested!=null&&Boolean.TRUE.equals(requested.startNow())?requested.withStartsAt(clock.instant()):requested; validate(project,c); Meeting m=new Meeting(); m.id=UUID.randomUUID(); m.projectId=project;
        m.organizerId=actor; m.roomName="pda-"+m.id; m.status=Meeting.Status.SCHEDULED;
        m.createdAt=clock.instant(); apply(m,c); meetings.save(m); audit(m,actor,null,"CREATED"); changed(m,actor,MeetingEvents.Type.CREATED); return view(m);
    }
    public View update(UUID project,UUID id,UUID actor,Command c) {
        Meeting m=load(project,id,actor); edit(m,actor); scheduled(m); validate(project,c); apply(m,c);
        audit(m,actor,null,"UPDATED"); changed(m,actor,MeetingEvents.Type.UPDATED); return view(m);
    }
    public View detail(UUID project,UUID id,UUID actor) { return view(load(project,id,actor)); }
    public PageView<View> list(UUID project,UUID actor,Meeting.Status status,Instant from,Instant to,int page,int size,String sort) {
        return list(project,actor,status,from,to,page,size,sort,HiddenMode.INCLUDE);
    }
    public PageView<View> list(UUID project,UUID actor,Meeting.Status status,Instant from,Instant to,int page,int size,String sort,HiddenMode mode) {
        member(project,actor); if(page<0||page>10000||size<1||size>100) throw error(400,"MEETING_INVALID_PAGE");
        if(from!=null&&to!=null&&(!from.isBefore(to)||Duration.between(from,to).compareTo(Duration.ofDays(366))>0)) throw error(400,"MEETING_INVALID_RANGE");
        String[] bits=sort.split(",",-1); if(bits.length!=2||!Set.of("startsAt","createdAt","title","status").contains(bits[0])||!Set.of("asc","desc").contains(bits[1])) throw error(400,"MEETING_INVALID_SORT");
        Specification<Meeting> filter=(r,q,b)->{
            var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>(); predicates.add(b.equal(r.get("projectId"),project));
            if(status!=null) predicates.add(b.equal(r.get("status"),status));
            if(from!=null) predicates.add(b.greaterThan(r.get("endsAt"),from));
            if(to!=null) predicates.add(b.lessThan(r.get("startsAt"),to));
            if(mode!=HiddenMode.INCLUDE) {
                // Only the caller own choices count: someone else clearing their history never changes this list.
                var mine=q.subquery(UUID.class); var h=mine.from(MeetingHidden.class); mine.select(h.get("meetingId")).where(b.equal(h.get("userId"),actor));
                predicates.add(mode==HiddenMode.ONLY?r.get("id").in(mine):b.not(r.get("id").in(mine)));
            }
            return b.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var result=meetings.findAll(filter,PageRequest.of(page,size,Sort.by(Sort.Direction.fromString(bits[1]),bits[0]).and(Sort.by("id"))));
        Set<UUID> mineHidden=result.isEmpty()||mode==HiddenMode.EXCLUDE?Set.of():hidden.hiddenAmong(actor,result.getContent().stream().map(m->m.id).toList());
        return PageView.of(result.map(m->view(m,mode==HiddenMode.ONLY||mineHidden.contains(m.id))));
    }
    /** Clears the finished and cancelled meetings from THIS user list. The meetings themselves, their chat, audit, notifications and reminders are untouched. */
    public HistoryResult clearHistory(UUID project,UUID actor) { member(project,actor); return new HistoryResult(hidden.hideHistory(project,actor,clock.instant())); }
    public HistoryResult restoreHistory(UUID project,UUID actor) { member(project,actor); return new HistoryResult(hidden.restoreHistory(project,actor)); }
    @Transactional(readOnly=true)
    public HistoryResult hiddenCount(UUID project,UUID actor) { member(project,actor); return new HistoryResult(hidden.countInProject(actor,project)); }
    public View cancel(UUID project,UUID id,UUID actor) {
        Meeting m=load(project,id,actor); edit(m,actor); if(m.status==Meeting.Status.CANCELLED) return view(m); scheduled(m);
        m.status=Meeting.Status.CANCELLED; m.endedAt=clock.instant(); m.updatedAt=clock.instant();
        audit(m,actor,null,"CANCELLED"); changed(m,actor,MeetingEvents.Type.CANCELLED); return view(m);
    }
    public View start(UUID project,UUID id,UUID actor) {
        Meeting m=load(project,id,actor); edit(m,actor); if(m.status==Meeting.Status.OPEN) return view(m); scheduled(m); open(m,actor); return view(m);
    }
    public View end(UUID project,UUID id,UUID actor) {
        Meeting m=load(project,id,actor); owner(m,actor); if(m.status==Meeting.Status.ENDED) return view(m);
        requireOpen(m); finish(m,actor); return view(m);
    }
    public void open(Meeting m,UUID actor) {
        media.createRoom(m.roomName,policy.getMaxParticipants()); m.status=Meeting.Status.OPEN; m.openedAt=clock.instant(); m.updatedAt=clock.instant();
        changed(m,actor,MeetingEvents.Type.OPENED); audit(m,actor,null,"OPENED");
    }
    public void finish(Meeting m,UUID actor) {
        m.status=Meeting.Status.ENDED; m.endedAt=clock.instant(); m.updatedAt=clock.instant(); m.cleanupPending=true; m.cleanupRetryAt=clock.instant();
        for(MeetingParticipant p:participants.findByMeetingId(m.id)) { p.revoked=true; p.connected=false; p.leftAt=clock.instant(); }
        if(!policy.isRetainChat()) chats.deleteByMeetingId(m.id);
        changed(m,actor,MeetingEvents.Type.ENDED); audit(m,actor,null,"ENDED");
    }
    public Join join(UUID project,UUID id,UUID actor) {
        Meeting m=load(project,id,actor); requireOpen(m); String identity="user-"+actor;
        MeetingParticipant p=participants.findByMeetingIdAndIdentity(id,identity).orElseGet(()->{
            var created=new MeetingParticipant(); created.id=UUID.randomUUID(); created.meetingId=id; created.userId=actor;
            created.identity=identity; var profile=projects.member(project,actor); created.displayName=profile==null?"Member":profile.nickname(); return created;
        });
        if(p.revoked) throw error(403,"MEETING_PARTICIPANT_REVOKED"); participants.save(p); return token(m,p);
    }
    Join token(Meeting m,MeetingParticipant p) {
        requireOpen(m); if(p.lastTokenAt!=null&&p.lastTokenAt.plusSeconds(2).isAfter(clock.instant())) throw error(429,"MEETING_TOKEN_RATE_LIMITED");
        if(!media.roomExists(m.roomName)) media.createRoom(m.roomName,policy.getMaxParticipants());
        if(media.listParticipants(m.roomName).size()>=policy.getMaxParticipants()&&!p.connected) throw error(409,"MEETING_FULL");
        p.lastTokenAt=clock.instant();
        return new Join(p.id,p.identity,media.issueToken(m.roomName,p.identity,p.displayName,policy.getTokenTtl()),policy.isRetainChat(),m.roomEpoch,m.status.name());
    }
    public void stageKick(UUID project,UUID id,UUID actor,UUID target) {
        Meeting m=load(project,id,actor); moderate(m,actor);
        if(m.status!=Meeting.Status.OPEN) throw error(409,"MEETING_NOT_OPEN");
        MeetingParticipant p=target(m,target); if(p.revoked) return;
        p.revoked=true; p.connected=false; p.leftAt=clock.instant();
        if(!m.rotationPending) { m.rotationPending=true; m.pendingRoomName=m.roomName; }
        audit(m,actor,target,"KICKED");
    }
    public void leave(UUID project,UUID id,UUID actor) {
        Meeting m=load(project,id,actor); MeetingParticipant p=participants.findByMeetingIdAndIdentity(id,"user-"+actor).orElseThrow(()->error(404,"MEETING_PARTICIPANT_NOT_FOUND"));
        media.removeParticipant(m.roomName,p.identity); p.connected=false; p.leftAt=clock.instant();
    }
    public List<ParticipantView> participants(UUID project,UUID id,UUID actor) {
        load(project,id,actor); List<MeetingParticipant> rows=participants.findByMeetingId(id);
        // Photos are only for signed-in members: the avatar endpoint needs a PDA session, which guests do not have.
        Map<UUID,ProjectMemberView> members=projects.membersByUserIds(project,rows.stream().map(p->p.userId).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet()));
        return rows.stream().map(p->participantView(p,p.userId==null?null:members.get(p.userId))).toList();
    }
    public void mute(UUID project,UUID id,UUID actor,UUID target) {
        Meeting m=load(project,id,actor); moderate(m,actor); requireOpen(m); MeetingParticipant p=target(m,target);
        media.muteParticipant(m.roomName,p.identity); audit(m,actor,target,"MUTED");
    }
    public PageView<InviteMetadata> listInvites(UUID project,UUID id,UUID actor,int page,int size) {
        Meeting meeting=load(project,id,actor); edit(meeting,actor);
        if(page<0||page>10000||size<1||size>100) throw error(400,"MEETING_INVALID_PAGE");
        return PageView.of(invites.findByMeetingId(id,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"expiresAt","id")))
            .map(invite->new InviteMetadata(invite.id,invite.expiresAt,invite.maxUses,invite.uses,invite.revoked)));
    }
    public InviteView invite(UUID project,UUID id,UUID actor,InviteRequest request) {
        Meeting m=load(project,id,actor); edit(m,actor); if(m.status==Meeting.Status.ENDED||m.status==Meeting.Status.CANCELLED) throw error(409,"MEETING_CLOSED");
        Instant now=clock.instant(); if(request.expiresAt()==null||!request.expiresAt().isAfter(now)||request.expiresAt().isAfter(now.plus(Duration.ofDays(30)))||request.maxUses()<1||request.maxUses()>100) throw error(400,"MEETING_INVALID_INVITE");
        MeetingInvite i=new MeetingInvite(); i.id=UUID.randomUUID(); i.meetingId=id; String secret=randomSecret(); i.tokenHash=hash(secret);
        i.expiresAt=request.expiresAt(); i.maxUses=request.maxUses(); invites.save(i); audit(m,actor,i.id,"INVITE_CREATED");
        return new InviteView(i.id,secret,i.expiresAt,i.maxUses);
    }
    public GuestView guestPreview(PreviewRequest request) {
        enabled();
        var scope=invites.scopeByTokenHash(hash(request.inviteToken())).orElseThrow(()->error(403,"MEETING_INVITE_INVALID"));
        Meeting m=locked(scope.getMeetingId());
        MeetingInvite invite=invites.findById(scope.getId()).orElseThrow(()->error(403,"MEETING_INVITE_INVALID"));
        if(invite.revoked||!invite.expiresAt.isAfter(clock.instant())||invite.uses>=invite.maxUses) throw error(403,"MEETING_INVITE_INVALID");
        return guestView(m);
    }
    public GuestView guestState(UUID meetingId,String secret) {
        Meeting m=locked(meetingId); guest(m,secret); return guestView(m);
    }
    private GuestView guestView(Meeting m) {
        return new GuestView(m.id,m.title,m.startsAt,m.endsAt,m.zoneId,m.status,m.openedAt,m.overtimeAt!=null,policy.isRetainChat(),
            List.copyOf(m.agenda),m.roomEpoch,m.rotationPending);
    }
    public GuestSession guestSession(GuestRequest request) {
        enabled(); if(request.inviteToken()==null||request.inviteToken().length()>100) throw error(403,"MEETING_INVITE_INVALID");
        var preliminary=invites.scopeByTokenHash(hash(request.inviteToken())).orElseThrow(()->error(403,"MEETING_INVITE_INVALID"));
        Meeting m=locked(preliminary.getMeetingId()); requireOpen(m); MeetingInvite i=invites.findById(preliminary.getId()).orElseThrow();
        Instant now=clock.instant(); if(i.revoked||!i.expiresAt.isAfter(now)||i.uses>=i.maxUses) throw error(403,"MEETING_INVITE_INVALID");
        if(request.displayName()==null||request.displayName().isBlank()||request.displayName().length()>80||request.displayName().matches("(?s).*[<>\\p{Cntrl}].*")) throw error(400,"MEETING_INVALID_NAME");
        if(participants.findByMeetingId(m.id).stream().filter(p->p.userId==null&&!p.revoked&&p.sessionExpiresAt.isAfter(now)).count()>=policy.getMaxParticipants()) throw error(409,"MEETING_FULL");
        i.uses++; MeetingParticipant p=new MeetingParticipant(); p.id=UUID.randomUUID(); p.meetingId=m.id; p.inviteId=i.id; p.identity="guest-"+p.id; p.displayName=request.displayName().strip();
        String secret=randomSecret(); p.sessionHash=hash(secret); p.sessionExpiresAt=now.plus(Duration.ofHours(12)); if(p.sessionExpiresAt.isAfter(i.expiresAt)) p.sessionExpiresAt=i.expiresAt;
        participants.save(p); audit(m,null,p.id,"GUEST_SESSION_CREATED"); return new GuestSession(m.id,p.id,secret,p.sessionExpiresAt);
    }
    public Join guestJoin(UUID meetingId,String secret) { Meeting m=locked(meetingId); MeetingParticipant p=guest(m,secret); return token(m,p); }
    MeetingParticipant guest(Meeting m,String secret) {
        enabled(); if(secret==null||secret.length()>100) throw error(403,"MEETING_GUEST_INVALID");
        MeetingParticipant p=participants.findBySessionHash(hash(secret)).orElseThrow(()->error(403,"MEETING_GUEST_INVALID"));
        if(!p.meetingId.equals(m.id)||p.revoked||p.sessionExpiresAt==null||!p.sessionExpiresAt.isAfter(clock.instant())) throw error(403,"MEETING_GUEST_INVALID");
        return p; // Invite revocation prevents new sessions; an existing bounded session remains valid.
    }
    public void revokeInvite(UUID project,UUID id,UUID actor,UUID inviteId) {
        Meeting m=load(project,id,actor); edit(m,actor); MeetingInvite i=invites.findById(inviteId).orElseThrow(()->error(404,"MEETING_INVITE_NOT_FOUND"));
        if(!i.meetingId.equals(id)) throw error(404,"MEETING_INVITE_NOT_FOUND"); i.revoked=true; audit(m,actor,inviteId,"INVITE_REVOKED");
    }
    public ChatView guestChat(UUID id,String secret,ChatRequest request) { Meeting m=locked(id); return sendChat(m,guest(m,secret),request); }
    public PageView<ChatView> guestHistory(UUID id,String secret,int page,int size) {
        Meeting m=locked(id); requireOpen(m); var p=guest(m,secret); active(m,p); if(page<0||page>1000||size<1||size>100) throw error(400,"MEETING_INVALID_PAGE");
        return historyPage(m,p,page,size);
    }
    public ChatView guestMessage(UUID id,String secret,UUID messageId) { Meeting m=locked(id); requireOpen(m); var p=guest(m,secret); active(m,p); return singleView(m,p,messageId); }
    public ChatLocation guestLocate(UUID id,String secret,UUID messageId,int size) { Meeting m=locked(id); requireOpen(m); var p=guest(m,secret); active(m,p); return locate(m,messageId,size); }
    public ChatView guestReact(UUID id,String secret,UUID messageId,String emoji) { Meeting m=locked(id); return react(m,guest(m,secret),messageId,emoji,true); }
    public ChatView guestUnreact(UUID id,String secret,UUID messageId,String emoji) { Meeting m=locked(id); return react(m,guest(m,secret),messageId,emoji,false); }
    public List<ParticipantView> guestParticipants(UUID id,String secret) { Meeting m=locked(id); requireOpen(m); guest(m,secret); return participants.findByMeetingId(id).stream().map(p->participantView(p,null)).toList(); }
    public void guestLeave(UUID id,String secret) { Meeting m=locked(id); var p=guest(m,secret); media.removeParticipant(m.roomName,p.identity); p.connected=false; p.leftAt=clock.instant(); p.revoked=true; }
    public ChatView chat(UUID project,UUID id,UUID actor,ChatRequest request) {
        Meeting m=load(project,id,actor); return sendChat(m,activeUser(m,actor),request);
    }
    public PageView<ChatView> history(UUID project,UUID id,UUID actor,int page,int size) {
        Meeting m=load(project,id,actor); var p=activeUser(m,actor); if(page<0||page>1000||size<1||size>100) throw error(400,"MEETING_INVALID_PAGE");
        return historyPage(m,p,page,size);
    }
    public ChatView message(UUID project,UUID id,UUID actor,UUID messageId) { Meeting m=load(project,id,actor); return singleView(m,activeUser(m,actor),messageId); }
    public ChatLocation locate(UUID project,UUID id,UUID actor,UUID messageId,int size) { Meeting m=load(project,id,actor); activeUser(m,actor); return locate(m,messageId,size); }
    public ChatView react(UUID project,UUID id,UUID actor,UUID messageId,String emoji) { Meeting m=load(project,id,actor); return react(m,activeUser(m,actor),messageId,emoji,true); }
    public ChatView unreact(UUID project,UUID id,UUID actor,UUID messageId,String emoji) { Meeting m=load(project,id,actor); return react(m,activeUser(m,actor),messageId,emoji,false); }
    /** Reactions are per verified participant and message. Adding is idempotent (the key decides); removing only ever touches the caller's own row. */
    ChatView react(Meeting m,MeetingParticipant p,UUID messageId,String emoji,boolean add) {
        requireOpen(m); active(m,p);
        if(!ChatEmoji.valid(emoji)) throw error(400,"MEETING_INVALID_REACTION");
        MeetingChatMessage message=chats.findByIdAndMeetingId(messageId,m.id).orElseThrow(()->error(404,"MEETING_MESSAGE_NOT_FOUND"));
        if(add) {
            // Bounded growth: a message carries at most 20 different emoji and one person at most 12 of them.
            if(reactions.exists(message.id,p.id,emoji)==0) {
                if(reactions.distinctEmojis(message.id)>=20&&reactions.withEmoji(message.id,emoji)==0) throw error(409,"MEETING_REACTION_LIMIT");
                if(reactions.byParticipant(message.id,p.id)>=12) throw error(409,"MEETING_REACTION_LIMIT");
                reactions.add(message.id,p.id,emoji,clock.instant());
            }
        } else reactions.remove(message.id,p.id,emoji);
        // Everyone in the room refreshes this one message from the REST source of truth; the envelope carries ids only.
        String envelope="{\"type\":\"meeting.chat.reaction\",\"meetingId\":\""+m.id+"\",\"messageId\":\""+message.id+"\"}";
        media.sendData(m.roomName,envelope.getBytes(StandardCharsets.UTF_8));
        return chatViews(m,p.id,List.of(message)).get(0);
    }
    ChatView singleView(Meeting m,MeetingParticipant viewer,UUID messageId) {
        return chatViews(m,viewer.id,List.of(chats.findByIdAndMeetingId(messageId,m.id).orElseThrow(()->error(404,"MEETING_MESSAGE_NOT_FOUND")))).get(0);
    }
    ChatLocation locate(Meeting m,UUID messageId,int size) {
        if(size<1||size>100) throw error(400,"MEETING_INVALID_PAGE");
        MeetingChatMessage message=chats.findByIdAndMeetingId(messageId,m.id).orElseThrow(()->error(404,"MEETING_MESSAGE_NOT_FOUND"));
        return new ChatLocation(message.id,(int)(chats.newerThan(m.id,message.sentAt,message.id)/size),size);
    }
    PageView<ChatView> historyPage(Meeting m,MeetingParticipant viewer,int page,int size) {
        Page<MeetingChatMessage> found=chats.findByMeetingId(m.id,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"sentAt","id")));
        List<ChatView> views=chatViews(m,viewer.id,found.getContent());
        return new PageView<>(views,found.getNumber(),found.getSize(),found.getTotalElements(),found.getTotalPages());
    }
    MeetingParticipant activeUser(Meeting m,UUID actor) {
        requireOpen(m); var p=participants.findByMeetingIdAndIdentity(m.id,"user-"+actor).orElseThrow(()->error(403,"MEETING_PARTICIPANT_REQUIRED")); active(m,p); return p;
    }
    void active(Meeting m,MeetingParticipant p) { if(p.revoked||!p.connected||media.listParticipants(m.roomName).stream().noneMatch(x->x.identity().equals(p.identity))) throw error(403,"MEETING_PARTICIPANT_REQUIRED"); }
    ChatView sendChat(Meeting m,MeetingParticipant p,ChatRequest request) {
        requireOpen(m); active(m,p); String text=request.content(); if(text==null||text.isBlank()||text.length()>2000||text.matches("(?s).*[<>\\p{Cntrl}&&[^\\n\\t]].*")) throw error(400,"MEETING_INVALID_MESSAGE");
        Instant now=clock.instant(); if(p.lastMessageAt!=null&&p.lastMessageAt.plusMillis(750).isAfter(now)) throw error(429,"MEETING_CHAT_RATE_LIMITED");
        Set<UUID> mentions=request.mentionIds(); if(mentions==null||mentions.size()>20) throw error(400,"MEETING_INVALID_MENTIONS");
        Set<String> current=new HashSet<>(); media.listParticipants(m.roomName).forEach(x->current.add(x.identity()));
        Set<UUID> valid=new HashSet<>(); for(var participant:participants.findByMeetingId(m.id)) if(participant.connected&&!participant.revoked&&current.contains(participant.identity)) valid.add(participant.id);
        if(!valid.containsAll(mentions)) throw error(400,"MEETING_INVALID_MENTIONS");
        // A reply must answer a message of THIS meeting; another meeting's id is reported like an unknown one (no hint that it exists).
        UUID replyTo=request.replyToMessageId();
        if(replyTo!=null&&chats.findByIdAndMeetingId(replyTo,m.id).isEmpty()) throw error(404,"MEETING_REPLY_TARGET_NOT_FOUND");
        MeetingChatMessage msg=new MeetingChatMessage(); msg.id=UUID.randomUUID(); msg.meetingId=m.id; msg.participantId=p.id; msg.displayName=p.displayName; msg.content=text.strip(); msg.sentAt=now; msg.mentionIds.addAll(mentions); msg.replyToMessageId=replyTo;
        chats.save(msg); p.lastMessageAt=now;
        // Data envelope is server generated; the REST source of truth provides bounded history after delivery loss.
        String envelope="{\"type\":\"meeting.chat\",\"meetingId\":\""+m.id+"\",\"messageId\":\""+msg.id+"\"}";
        media.sendData(m.roomName,envelope.getBytes(StandardCharsets.UTF_8)); return chatViews(m,p.id,List.of(msg)).get(0);
    }
    void validate(UUID project,Command c) {
        if(c==null||c.title()==null||c.title().isBlank()||c.title().length()>160||c.description()!=null&&c.description().length()>4000||c.startsAt()==null||c.endsAt()==null||!c.startsAt().isBefore(c.endsAt())||c.startsAt().isBefore(clock.instant().minusSeconds(5))||Duration.between(c.startsAt(),c.endsAt()).compareTo(Duration.ofHours(24))>0) throw error(400,"MEETING_INVALID_SCHEDULE");
        if(invalidText(c.title())||invalidText(c.description())) throw error(400,"MEETING_INVALID_REQUEST");
        if(c.icon()!=null&&!ICONS.contains(c.icon())) throw error(400,"MEETING_INVALID_ICON");
        try { ZoneId.of(c.zoneId()); } catch(Exception e) { throw error(400,"MEETING_INVALID_TIMEZONE"); }
        if(c.agenda()==null||c.agenda().size()>30||c.agenda().stream().anyMatch(x->x==null||x.isBlank()||x.length()>1000||invalidText(x))||c.attendeeIds()==null||c.attendeeIds().size()>100||c.attendeeIds().stream().anyMatch(Objects::isNull)) throw error(400,"MEETING_INVALID_REQUEST");
        if(!projects.activeMemberIds(project,c.attendeeIds()).containsAll(c.attendeeIds())) throw error(400,"MEETING_INVALID_ATTENDEES");
    }
    private boolean invalidText(String value) { return value!=null&&value.chars().anyMatch(c->Character.isISOControl(c)&&c!='\n'&&c!='\r'&&c!='\t'); }
    void apply(Meeting m,Command c) {
        if(!Objects.equals(m.startsAt,c.startsAt())||!m.attendeeIds.equals(c.attendeeIds())) m.reminderRevision++;
        m.title=c.title().strip(); m.description=c.description()==null?"":c.description(); m.startsAt=c.startsAt(); m.endsAt=c.endsAt(); m.zoneId=c.zoneId(); m.agenda.clear(); m.agenda.addAll(c.agenda()); if(c.icon()!=null) m.icon=c.icon(); m.attendeeIds.clear(); m.attendeeIds.addAll(c.attendeeIds()); m.updatedAt=clock.instant();
    }
    void scheduled(Meeting m) { if(m.status!=Meeting.Status.SCHEDULED) throw error(409,"MEETING_NOT_SCHEDULED"); }
    void requireOpen(Meeting m) { if(m.rotationPending) throw error(503,"MEETING_RECONNECT_PENDING"); if(m.status!=Meeting.Status.OPEN) throw error(409,"MEETING_NOT_OPEN"); }
    MeetingParticipant target(Meeting m,UUID id) { var p=participants.findById(id).orElseThrow(()->error(404,"MEETING_PARTICIPANT_NOT_FOUND")); if(!p.meetingId.equals(m.id)) throw error(404,"MEETING_PARTICIPANT_NOT_FOUND"); return p; }
    public void audit(Meeting m,UUID actor,UUID target,String action) { var a=new MeetingAudit(); a.id=UUID.randomUUID(); a.meetingId=m.id; a.actorId=actor; a.targetId=target; a.action=action; a.occurredAt=clock.instant(); audits.save(a); }
    public void changed(Meeting m,UUID actor,MeetingEvents.Type type) {
        Set<UUID> recipients=new HashSet<>(); int page=0; Page<ProjectMemberView> batch;
        do { batch=projects.members(m.projectId,PageRequest.of(page++,100)); batch.forEach(x->recipients.add(x.userId())); } while(batch.hasNext());
        events.publishEvent(new MeetingEvents.Changed(UUID.randomUUID(),m.id,m.projectId,actor,type,m.title,recipients,clock.instant()));
    }
    View view(Meeting m) { return view(m,false); }
    View view(Meeting m,boolean hiddenForCaller) { return new View(m.id,m.projectId,m.organizerId,m.title,m.description,m.startsAt,m.endsAt,m.zoneId,m.status,m.openedAt,m.endedAt,m.overtimeAt!=null,policy.isRetainChat(),m.version,List.copyOf(m.agenda),Set.copyOf(m.attendeeIds),m.roomEpoch,m.rotationPending,m.cleanupPending,m.icon,hiddenForCaller); }
    /** {@code member} is the participant's active project membership; null (guests, guest callers, ex-members) exposes no user id or photo. */
    ParticipantView participantView(MeetingParticipant p,ProjectMemberView member) {
        return new ParticipantView(p.id,p.identity,p.displayName,p.userId==null,p.connected,p.revoked,p.joinedAt,p.leftAt,
            member==null?null:member.userId(),member==null?null:member.profilePhotoVersion());
    }
    static final int REPLY_PREVIEW=160, REACTORS_SHOWN=20;
    /** The views of a batch of messages with their reply quotes and reactions loaded in ONE query each (never one per message). */
    List<ChatView> chatViews(Meeting meeting,UUID viewer,List<MeetingChatMessage> messages) {
        if(messages.isEmpty()) return List.of();
        Map<UUID,MeetingChatMessage> quoted=new HashMap<>();
        Set<UUID> quoteIds=new HashSet<>(); for(var m:messages) if(m.replyToMessageId!=null) quoteIds.add(m.replyToMessageId);
        if(!quoteIds.isEmpty()) for(var q:chats.findAllById(quoteIds)) if(q.meetingId.equals(meeting.id)) quoted.put(q.id,q);
        Map<UUID,List<MeetingChatReaction>> byMessage=new HashMap<>();
        for(var r:reactions.findByMessageIdInOrderByCreatedAtAscEmojiAsc(messages.stream().map(x->x.id).toList())) byMessage.computeIfAbsent(r.messageId,k->new ArrayList<>()).add(r);
        Map<UUID,String> names=new HashMap<>(); if(!byMessage.isEmpty()) for(var p:participants.findByMeetingId(meeting.id)) names.put(p.id,p.displayName);
        List<ChatView> views=new ArrayList<>(messages.size());
        for(var m:messages) {
            var q=m.replyToMessageId==null?null:quoted.get(m.replyToMessageId);
            ReplyView reply=q==null?null:new ReplyView(q.id,q.participantId,q.displayName,preview(q.content));
            views.add(new ChatView(m.id,m.participantId,m.displayName,m.content,m.sentAt,Set.copyOf(m.mentionIds),m.replyToMessageId,reply,reactionViews(byMessage.getOrDefault(m.id,List.of()),viewer,names)));
        }
        return views;
    }
    private static List<ReactionView> reactionViews(List<MeetingChatReaction> rows,UUID viewer,Map<UUID,String> names) {
        Map<String,List<MeetingChatReaction>> grouped=new LinkedHashMap<>(); for(var r:rows) grouped.computeIfAbsent(r.emoji,k->new ArrayList<>()).add(r);
        List<ReactionView> out=new ArrayList<>(grouped.size());
        grouped.forEach((emoji,list)->out.add(new ReactionView(emoji,list.size(),list.stream().anyMatch(r->r.participantId.equals(viewer)),
            list.stream().limit(REACTORS_SHOWN).map(r->new ReactorView(r.participantId,names.getOrDefault(r.participantId,""))).toList())));
        return out;
    }
    private static String preview(String content) {
        String flat=content.replaceAll("\\s+"," ").strip();
        if(flat.length()<=REPLY_PREVIEW) return flat;
        int end=REPLY_PREVIEW; if(Character.isHighSurrogate(flat.charAt(end-1))) end--;
        return flat.substring(0,end)+"…";
    }
    static String randomSecret() { byte[] bytes=new byte[32]; RANDOM.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    static String hash(String secret) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8))); } catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); } }
    static MeetingException error(int status,String code) { return new MeetingException(status,code); }
}
