package com.pda.meeting.internal;

import com.pda.meeting.*;
import com.pda.project.ProjectMemberRemovedEvent;
import com.pda.project.ProjectAccess;
import com.pda.user.UserAccounts;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class MeetingLifecycle implements MeetingMediaEvents {
    private final MeetingService service;
    private final MeetingWebhookRepository webhooks;
    private final UserAccounts users;
    private final MeetingPolicy policy;
    private final MeetingMediaPort media;
    private final MeetingRepository meetings;
    private final MeetingParticipantRepository participants;
    private final ProjectAccess projects;
    private final Clock clock;
    public MeetingLifecycle(MeetingService service,MeetingWebhookRepository webhooks,UserAccounts users,
        MeetingPolicy policy,MeetingMediaPort media,MeetingRepository meetings,MeetingParticipantRepository participants,
        ProjectAccess projects,Clock clock) {
        this.service=service; this.webhooks=webhooks; this.users=users; this.policy=policy; this.media=media;
        this.meetings=meetings; this.participants=participants; this.projects=projects; this.clock=clock;
    }
    @Transactional
    public void tick(UUID id) {
        if(!policy.isEnabled()) return;
        Meeting m=service.locked(id); Instant now=clock.instant();
        if(m.rotationPending) { rotate(m); return; }
        if(m.cleanupPending&&(m.cleanupRetryAt==null||!m.cleanupRetryAt.isAfter(now))) {
            try { media.deleteRoom(m.roomName); m.cleanupPending=false; }
            catch(RuntimeException failure) { m.cleanupAttempts++; m.cleanupRetryAt=now.plusSeconds(Math.min(300,5L*(1L<<Math.min(m.cleanupAttempts,6)))); }
            return;
        }
        var project=projects.taskContext(m.projectId);
        if(project!=null&&project.archived()) {
            if(m.status==Meeting.Status.OPEN||m.status==Meeting.Status.SCHEDULED) service.finish(m,null);
            return;
        }
        if(m.status==Meeting.Status.OPEN) {
            for(var p:participants.findByMeetingId(id)) {
                if(!p.revoked&&p.userId!=null&&(!projects.isMember(m.projectId,p.userId)||users.findActiveById(p.userId).isEmpty())) revokeMembership(m,p);
                else if(!p.revoked&&p.userId==null&&p.sessionExpiresAt!=null&&!p.sessionExpiresAt.isAfter(now)) {
                    p.revoked=true; p.connected=false; p.leftAt=now;
                    if(p.lastTokenAt!=null&&!m.rotationPending) { m.rotationPending=true; m.pendingRoomName=m.roomName; }
                    service.audit(m,null,p.id,"GUEST_SESSION_EXPIRED");
                }
            }
            if(m.rotationPending) { rotate(m); return; }
        }
        if(m.status==Meeting.Status.SCHEDULED&&!m.startsAt.isAfter(now)) service.open(m,null);
        if(m.status!=Meeting.Status.OPEN) return;
        if(!media.roomExists(m.roomName)) media.createRoom(m.roomName,policy.getMaxParticipants());
        if(!m.endsAt.isAfter(now)&&m.overtimeAt==null) { m.overtimeAt=now; service.changed(m,null,MeetingEvents.Type.OVERTIME); }
        // Provider presence is authoritative, including after restart or webhook loss.
        var connected=media.listParticipants(m.roomName); Set<String> identities=new HashSet<>(); connected.forEach(p->identities.add(p.identity()));
        for(var p:participants.findByMeetingId(id)) {
            if(identities.contains(p.identity)&&!p.revoked) { p.connected=true; m.everJoined=true; if(p.joinedAt==null) p.joinedAt=now; }
            else if(p.connected) { p.connected=false; p.leftAt=now; }
        }
        if(connected.isEmpty()) {
            if(m.emptySince==null) m.emptySince=now;
            // A never-attended scheduled room remains open through its scheduled end plus grace.
            Instant base=m.everJoined?m.emptySince:(m.endsAt.isAfter(m.emptySince)?m.endsAt:m.emptySince);
            if(!base.plus(policy.getEmptyGrace()).isAfter(now)) service.finish(m,null);
        } else m.emptySince=null;
    }
    @EventListener @Transactional
    public void memberRemoved(ProjectMemberRemovedEvent event) {
        for(var id:meetings.idsByProject(event.projectId())) {
            Meeting m=service.locked(id);
            if(m.status!=Meeting.Status.OPEN) continue;
            for(var p:participants.findByMeetingId(m.id)) if(event.userId().equals(p.userId)&&!p.revoked) revokeMembership(m,p);
        }
    }
    private void revokeMembership(Meeting m,MeetingParticipant p) {
        p.revoked=true; p.connected=false; p.leftAt=clock.instant();
        if(!m.rotationPending) { m.rotationPending=true; m.pendingRoomName=m.roomName; }
        service.audit(m,null,p.id,"SYSTEM_MEMBERSHIP_REVOKED");
    }
    @Transactional
    public boolean retryRotation(UUID id) { return rotate(service.locked(id)); }
    private boolean rotate(Meeting m) {
        if(!m.rotationPending) return true;
        try {
            // Persisted old room remains the deny boundary until deletion is confirmed.
            media.deleteRoom(m.pendingRoomName);
            if(media.roomExists(m.pendingRoomName)) return false;
            String next="pda-"+m.id+"-e"+(m.roomEpoch+1);
            media.createRoom(next,policy.getMaxParticipants());
            m.roomName=next; m.roomEpoch++; m.rotationPending=false; m.pendingRoomName=null;
            m.emptySince=clock.instant();
            for(var p:participants.findByMeetingId(m.id)) p.connected=false;
            return true;
        } catch(RuntimeException failure) { m.cleanupAttempts++; return false; }
    }
    @Override @Transactional
    public void accept(String eventId,String type,String roomName,String identity,Instant occurredAt) {
        if(!policy.isEnabled()||eventId==null||eventId.length()>128||roomName==null||!Set.of("room_started","room_finished","participant_joined","participant_left").contains(type)) return;
        UUID id=meetings.idByRoom(roomName).orElse(null); if(id==null) return;
        Meeting m=service.locked(id);
        if(!m.roomName.equals(roomName)||m.rotationPending||m.status!=Meeting.Status.OPEN||webhooks.existsById(eventId)) return;
        MeetingWebhookEvent event=new MeetingWebhookEvent(); event.id=eventId; event.receivedAt=clock.instant(); webhooks.save(event);
        // Query authoritative media state instead of trusting potentially out-of-order presence events.
        if(type.startsWith("participant_")) {
            var present=media.listParticipants(roomName); Set<String> identities=new HashSet<>(); present.forEach(p->identities.add(p.identity()));
            for(var p:participants.findByMeetingId(m.id)) {
                if(p.revoked&&identities.contains(p.identity)) { media.removeParticipant(roomName,p.identity); continue; }
                boolean connected=identities.contains(p.identity);
                if(connected) { m.everJoined=true; if(p.joinedAt==null) p.joinedAt=clock.instant(); m.emptySince=null; }
                if(p.connected&&!connected) p.leftAt=clock.instant(); p.connected=connected;
            }
        }
        // room_finished alone never ends a scheduled record: reconciliation applies documented empty grace.
    }
}
