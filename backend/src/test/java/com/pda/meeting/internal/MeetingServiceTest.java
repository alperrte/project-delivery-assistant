package com.pda.meeting.internal;

import com.pda.meeting.*;
import com.pda.project.ProjectAccess;
import com.pda.project.ProjectSummaryView;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.pda.meeting.internal.MeetingDtos.*;

class MeetingServiceTest {
    MeetingRepository meetings=mock(MeetingRepository.class);
    MeetingParticipantRepository participants=mock(MeetingParticipantRepository.class);
    MeetingInviteRepository invites=mock(MeetingInviteRepository.class);
    MeetingChatRepository chats=mock(MeetingChatRepository.class);
    MeetingChatReactionRepository reactions=mock(MeetingChatReactionRepository.class);
    MeetingAuditRepository audits=mock(MeetingAuditRepository.class);
    MeetingHiddenRepository hidden=mock(MeetingHiddenRepository.class);
    UserAccounts users=mock(UserAccounts.class);
    ProjectAccess projects=mock(ProjectAccess.class);
    MeetingMediaPort media=mock(MeetingMediaPort.class);
    ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);
    MeetingWebhookRepository webhooks=mock(MeetingWebhookRepository.class);
    MeetingPolicy policy=new MeetingPolicy();
    UUID actor=UUID.randomUUID();
    Instant now=Instant.parse("2026-10-18T12:00:00Z");
    Clock clock=Clock.fixed(now,ZoneOffset.UTC);
    MeetingService service;
    MeetingLifecycle lifecycle;
    Meeting meeting;
    @BeforeEach void setup() {
        policy.setEnabled(true);
        service=new MeetingService(meetings,participants,invites,chats,reactions,audits,hidden,projects,users,new MeetingPeopleSearchLimiter(clock),media,policy,events,clock);
        lifecycle=new MeetingLifecycle(service,webhooks,users,policy,media,meetings,participants,clock);
        meeting=new Meeting(); meeting.id=UUID.randomUUID(); meeting.organizerId=actor;
        meeting.status=Meeting.Status.OPEN; meeting.roomName="pda-"+meeting.id; meeting.title="Meeting"; meeting.description="";
        meeting.startsAt=now.minusSeconds(3600); meeting.endsAt=now.plusSeconds(3600); meeting.createdAt=now;
        when(meetings.lock(meeting.id)).thenReturn(Optional.of(meeting));
        when(participants.findByMeetingId(meeting.id)).thenReturn(List.of());
        when(media.listParticipants(anyString())).thenReturn(List.of());
        when(media.roomExists(anyString())).thenReturn(true);
    }
    /** A signed-in attendee of the meeting who is not its organizer. */
    private UUID attendee() { UUID attendee=UUID.randomUUID(); meeting.attendeeIds.add(attendee); return attendee; }
    @Test void previewValidatesCapabilityWithoutConsumingOrCreatingSession() {
        MeetingInvite invite=new MeetingInvite(); invite.id=UUID.randomUUID(); invite.meetingId=meeting.id;
        invite.expiresAt=now.plusSeconds(60); invite.maxUses=1;
        MeetingInviteRepository.InviteScope scope=mock(MeetingInviteRepository.InviteScope.class);
        when(scope.getId()).thenReturn(invite.id); when(scope.getMeetingId()).thenReturn(meeting.id);
        when(invites.scopeByTokenHash(MeetingService.hash("test-invite"))).thenReturn(Optional.of(scope));
        when(invites.findById(invite.id)).thenReturn(Optional.of(invite));
        assertEquals(meeting.title,service.guestPreview(new PreviewRequest("test-invite")).title());
        assertEquals(0,invite.uses); verify(participants,never()).save(any()); verifyNoInteractions(media);
        invite.revoked=true;
        assertEquals("MEETING_INVITE_INVALID",assertThrows(MeetingException.class,()->service.guestPreview(new PreviewRequest("test-invite"))).code());
        invite.revoked=false; invite.expiresAt=now;
        assertThrows(MeetingException.class,()->service.guestPreview(new PreviewRequest("test-invite")));
        invite.expiresAt=now.plusSeconds(60); invite.uses=1;
        assertThrows(MeetingException.class,()->service.guestPreview(new PreviewRequest("test-invite")));
    }
    @Test void guestStateRequiresMatchingLiveSessionAndExposesClosedStatusForCleanup() {
        var participant=new MeetingParticipant(); participant.meetingId=meeting.id; participant.sessionExpiresAt=now.plusSeconds(60);
        when(participants.findBySessionHash(MeetingService.hash("test-session"))).thenReturn(Optional.of(participant));
        meeting.status=Meeting.Status.ENDED; meeting.roomEpoch=3;
        assertEquals(Meeting.Status.ENDED,service.guestState(meeting.id,"test-session").status());
        assertEquals(3,service.guestState(meeting.id,"test-session").roomEpoch());
        verifyNoInteractions(invites);
        participant.meetingId=UUID.randomUUID(); assertThrows(MeetingException.class,()->service.guestState(meeting.id,"test-session"));
        participant.meetingId=meeting.id; participant.revoked=true; assertThrows(MeetingException.class,()->service.guestState(meeting.id,"test-session"));
    }
    @Test void inviteMetadataRequiresTheOrganizerAndHasBoundedPagination() {
        UUID organizer=UUID.randomUUID(); meeting.organizerId=organizer; meeting.attendeeIds.add(actor);
        assertEquals(403,assertThrows(MeetingException.class,()->service.listInvites(meeting.id,actor,0,20)).status());
        verify(invites,never()).findByMeetingId(any(),any());
        assertEquals(400,assertThrows(MeetingException.class,()->service.listInvites(meeting.id,organizer,-1,20)).status());
        assertEquals(400,assertThrows(MeetingException.class,()->service.listInvites(meeting.id,organizer,0,101)).status());
    }
    @Test void anAttendeeCannotMuteOrKickAndAStrangerDoesNotEvenSeeTheMeeting() {
        UUID organizer=UUID.randomUUID(); meeting.organizerId=organizer; meeting.attendeeIds.add(actor);
        assertEquals("MEETING_OWNER_REQUIRED",assertThrows(MeetingException.class,()->service.mute(meeting.id,actor,UUID.randomUUID())).code());
        assertEquals("MEETING_OWNER_REQUIRED",assertThrows(MeetingException.class,()->service.stageKick(meeting.id,actor,UUID.randomUUID())).code());
        UUID stranger=UUID.randomUUID();
        assertEquals("MEETING_NOT_FOUND",assertThrows(MeetingException.class,()->service.mute(meeting.id,stranger,UUID.randomUUID())).code());
        assertEquals("MEETING_NOT_FOUND",assertThrows(MeetingException.class,()->service.stageKick(meeting.id,stranger,UUID.randomUUID())).code());
        verifyNoInteractions(media);
    }
    @Test void onlyTheOrganizerEndsForEveryoneNoAttendeeAndNoProjectRole() {
        UUID organizer=UUID.randomUUID(); meeting.organizerId=organizer; UUID guestOfHonour=attendee(); meeting.attendeeIds.add(actor);
        // An attendee is refused with 403; somebody uninvited gets the same 404 as for an unknown meeting; nothing happens either way.
        var refused=assertThrows(MeetingException.class,()->service.end(meeting.id,actor));
        assertEquals(403,refused.status()); assertEquals("MEETING_OWNER_REQUIRED",refused.code());
        assertEquals("MEETING_OWNER_REQUIRED",assertThrows(MeetingException.class,()->service.end(meeting.id,guestOfHonour)).code());
        assertEquals(404,assertThrows(MeetingException.class,()->service.end(meeting.id,UUID.randomUUID())).status());
        assertEquals(Meeting.Status.OPEN,meeting.status); assertFalse(meeting.cleanupPending);
        verify(chats,never()).deleteByMeetingId(any()); verifyNoInteractions(media);
        service.end(meeting.id,organizer);
        assertEquals(Meeting.Status.ENDED,meeting.status); assertTrue(meeting.cleanupPending);
        // Afterwards the answer for a non-owner is unchanged (the ended state is not a way to probe or to succeed).
        assertEquals("MEETING_OWNER_REQUIRED",assertThrows(MeetingException.class,()->service.end(meeting.id,actor)).code());
    }
    @Test void anAttendeeJoiningFirstNeverBecomesAnOwner() {
        UUID organizer=UUID.randomUUID(); meeting.organizerId=organizer; meeting.attendeeIds.add(actor);
        MeetingParticipant first=new MeetingParticipant(); first.id=UUID.randomUUID(); first.meetingId=meeting.id; first.userId=actor; first.identity="user-"+actor;
        when(participants.findByMeetingId(meeting.id)).thenReturn(List.of(first));
        assertEquals("MEETING_OWNER_REQUIRED",assertThrows(MeetingException.class,()->service.end(meeting.id,actor)).code());
        when(participants.findById(first.id)).thenReturn(Optional.of(first));
        assertEquals("MEETING_OWNER_REQUIRED",assertThrows(MeetingException.class,()->service.mute(meeting.id,actor,first.id)).code());
        assertDoesNotThrow(()->service.mute(meeting.id,organizer,first.id));
    }
    @Test void aStrangerGetsNotFoundForDetailJoinAndChatEvenWithAGlobalRole() {
        UUID stranger=UUID.randomUUID();
        for(Runnable attempt:List.<Runnable>of(()->service.detail(meeting.id,stranger),()->service.join(meeting.id,stranger),
                ()->service.chat(meeting.id,stranger,new ChatRequest("text",Set.of())),()->service.participants(meeting.id,stranger))) {
            var denied=assertThrows(MeetingException.class,attempt::run); assertEquals(404,denied.status()); assertEquals("MEETING_NOT_FOUND",denied.code());
        }
        verifyNoInteractions(media); verify(chats,never()).save(any());
    }
    @Test void anAttendeeCanReadAndJoinWithoutAnyProject() {
        UUID attendee=attendee();
        when(users.findActiveById(attendee)).thenReturn(Optional.of(new UserAccounts.AuthenticatedUser(attendee,"a@example.test","Attendee","USER",false,null)));
        when(users.findActiveProfilesByIds(any())).thenReturn(Map.of(attendee,new UserAccounts.ProfileSummary(attendee,"Attendee","A","B",7L)));
        when(media.issueToken(anyString(),anyString(),anyString(),any())).thenReturn(new MeetingMediaPort.MediaJoin("wss://example.test","TEST-ONLY",now.plusSeconds(60)));
        var view=service.detail(meeting.id,attendee);
        assertEquals(meeting.id,view.id()); assertEquals(1,view.attendees().size()); assertEquals("Attendee",view.attendees().getFirst().nickname()); assertEquals(7L,view.attendees().getFirst().profilePhotoVersion());
        assertEquals("user-"+attendee,service.join(meeting.id,attendee).identity());
    }
    @Test void pastAndOverlongSchedulesRejected() {
        var past=new Command("Title","",now.minusSeconds(10),now.plusSeconds(10),"UTC",List.of(),Set.of());
        assertThrows(MeetingException.class,()->service.create(actor,past));
        var overlong=new Command("Title","",now.plusSeconds(10),now.plus(Duration.ofHours(25)),"UTC",List.of(),Set.of());
        assertThrows(MeetingException.class,()->service.create(actor,overlong));
        var controlText=new Command("Title\u0000","",now.plusSeconds(10),now.plusSeconds(60),"UTC",List.of(),Set.of());
        assertEquals(400,assertThrows(MeetingException.class,()->service.create(actor,controlText)).status());
        verify(meetings,never()).save(any());
    }
    @Test void creatingNeedsASessionButNeverAProject() {
        var plain=new Command("Solo","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of());
        assertEquals(401,assertThrows(MeetingException.class,()->service.create(null,plain)).status());
        var view=service.create(actor,plain);
        assertEquals(actor,view.organizerId());
        verify(meetings).save(argThat(saved->actor.equals(saved.organizerId)));
    }
    @Test void attendeesMustBeActiveAccountsOfAnyProjectAndTheOrganizerIsNotDuplicated() {
        UUID elsewhere=UUID.randomUUID(),ghost=UUID.randomUUID();
        when(users.findActiveByIds(Set.of(elsewhere))).thenReturn(Map.of(elsewhere,new UserAccounts.AuthenticatedUser(elsewhere,"e@example.test","Elsewhere","USER",false,null)));
        when(users.findActiveByIds(Set.of(ghost))).thenReturn(Map.of());
        var invalid=new Command("Team","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(ghost));
        assertEquals("MEETING_INVALID_ATTENDEES",assertThrows(MeetingException.class,()->service.create(actor,invalid)).code());
        verify(meetings,never()).save(any());
        var view=service.create(actor,new Command("Team","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(elsewhere)));
        assertEquals(Set.of(elsewhere),view.attendeeIds());
        // Naming the organizer as an attendee as well changes nothing: they are the organizer already.
        when(users.findActiveByIds(Set.of(elsewhere,actor))).thenReturn(Map.of(elsewhere,mock(UserAccounts.AuthenticatedUser.class),actor,mock(UserAccounts.AuthenticatedUser.class)));
        assertEquals(Set.of(elsewhere),service.create(actor,new Command("Team","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(elsewhere,actor))).attendeeIds());
    }
    @Test void changedEventsReachOnlyTheOrganizerAndTheAttendees() {
        UUID attendee=attendee();
        meeting.status=Meeting.Status.SCHEDULED; meeting.startsAt=now.plusSeconds(60); meeting.endsAt=now.plusSeconds(3600);
        service.cancel(meeting.id,actor);
        verify(events).publishEvent(argThat((Object event)->event instanceof MeetingEvents.Changed changed
            &&changed.type()==MeetingEvents.Type.CANCELLED&&changed.recipientIds().equals(Set.of(actor,attendee))));
    }
    @Test void startNowTakesTheServerClockSoASlowClientIsNotRefusedAsThePast() {
        // The browser sent its own "now", 40 seconds behind this server: without the flag that is a past start and is refused.
        var slow=new Command("Now","",now.minusSeconds(40),now.plusSeconds(3600),"UTC",List.of(),Set.of());
        assertEquals("MEETING_INVALID_SCHEDULE",assertThrows(MeetingException.class,()->service.create(actor,slow)).code());
        var withFlag=new Command("Now","",now.minusSeconds(40),now.plusSeconds(3600),"UTC",List.of(),Set.of(),null,true);
        assertEquals(now,service.create(actor,withFlag).startsAt());
        // The server clock cannot hide a bad end: an end that is already over is still refused, and so is more than 24 hours.
        var endedAlready=new Command("Now","",now,now.minusSeconds(5),"UTC",List.of(),Set.of(),null,true);
        assertEquals("MEETING_INVALID_SCHEDULE",assertThrows(MeetingException.class,()->service.create(actor,endedAlready)).code());
        var tooLong=new Command("Now","",now,now.plus(Duration.ofHours(25)),"UTC",List.of(),Set.of(),null,true);
        assertEquals("MEETING_INVALID_SCHEDULE",assertThrows(MeetingException.class,()->service.create(actor,tooLong)).code());
    }
    @Test void iconIsAnAllowlistedNameThatDefaultsToVideoAndSurvivesAnUpdateWithoutIcon() {
        var plain=new Command("Icon","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of());
        assertEquals("video",service.create(actor,plain).icon());
        var chosen=new Command("Icon","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),"presentation",null);
        assertEquals("presentation",service.create(actor,chosen).icon());
        for(String bad:new String[]{"<script>","Video","rocket",""}) {
            var invalid=new Command("Icon","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),bad,null);
            assertEquals("MEETING_INVALID_ICON",assertThrows(MeetingException.class,()->service.create(actor,invalid)).code());
        }
        for(String name:MeetingService.ICONS) assertEquals(name,service.create(actor,new Command("Icon","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),name,null)).icon());
        // An update that does not mention the icon keeps the stored one.
        meeting.status=Meeting.Status.SCHEDULED; meeting.icon="code"; meeting.startsAt=now.plusSeconds(60); meeting.endsAt=now.plusSeconds(3600);
        service.update(meeting.id,actor,new Command("Renamed","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of()));
        assertEquals("code",meeting.icon);
    }
    // ---- hybrid meetings: independent or project ------------------------------------------------------------------------------
    private Command project(UUID project,Set<UUID> attendees) { return new Command("Team","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),attendees,null,null,Meeting.Kind.PROJECT,project); }
    private ProjectSummaryView summary(UUID id,String name) { return new ProjectSummaryView(id,"slug-"+name,name,5L,Set.of(),null,null); }
    @Test void aProjectMeetingNeedsARealProjectTheCallerBelongsTo() {
        UUID mine=UUID.randomUUID(),foreign=UUID.randomUUID();
        when(projects.isMember(mine,actor)).thenReturn(true); when(projects.isMember(foreign,actor)).thenReturn(false);
        assertEquals("MEETING_INVALID_PROJECT",assertThrows(MeetingException.class,()->service.create(actor,project(null,Set.of()))).code());
        // A project the caller is not in and a project that does not exist are answered the same way: ids cannot be probed.
        for(UUID refused:List.of(foreign,UUID.randomUUID())) { var failure=assertThrows(MeetingException.class,()->service.create(actor,project(refused,Set.of()))); assertEquals(403,failure.status()); assertEquals("MEETING_PROJECT_FORBIDDEN",failure.code()); }
        verify(meetings,never()).save(any());
        var view=service.create(actor,project(mine,Set.of()));
        assertEquals(Meeting.Kind.PROJECT,view.meetingType());
        verify(meetings).save(argThat(saved->mine.equals(saved.projectId)&&actor.equals(saved.organizerId)));
    }
    @Test void anIndependentMeetingCarriesNoProjectAndNeverAsksProjectAccess() {
        var view=service.create(actor,new Command("Solo","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of()));
        assertEquals(Meeting.Kind.INDEPENDENT,view.meetingType()); assertNull(view.project());
        verifyNoInteractions(projects);
        verify(meetings).save(argThat(saved->saved.projectId==null));
        // Naming a project on an independent meeting (or leaving the type out) is refused rather than silently ignored.
        for(Meeting.Kind kind:new Meeting.Kind[]{Meeting.Kind.INDEPENDENT,null}) {
            var contradictory=new Command("Solo","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),null,null,kind,UUID.randomUUID());
            assertEquals("MEETING_INVALID_PROJECT",assertThrows(MeetingException.class,()->service.create(actor,contradictory)).code());
        }
    }
    @Test void projectMembershipIsNotMeetingMembershipAndAProjectMeetingStaysInvitationOnly() {
        UUID mine=UUID.randomUUID(),mate=UUID.randomUUID();
        when(projects.isMember(mine,actor)).thenReturn(true); when(projects.isMember(mine,mate)).thenReturn(true);
        meeting.projectId=mine; // a project meeting organized by actor; mate belongs to the same project but was never invited
        assertEquals("MEETING_NOT_FOUND",assertThrows(MeetingException.class,()->service.detail(meeting.id,mate)).code());
        assertEquals(404,assertThrows(MeetingException.class,()->service.join(meeting.id,mate)).status());
        // Creating the meeting did not add the project's members: only the people named in the request attend.
        var view=service.create(actor,project(mine,Set.of()));
        assertEquals(Set.of(),view.attendeeIds());
        verify(projects,never()).members(any(),any()); verify(projects,never()).activeMemberIds(any(),any());
    }
    @Test void theProjectIsShownOnlyToViewersWhoAreMembersOfIt() {
        UUID id=UUID.randomUUID(); meeting.projectId=id; UUID outsider=attendee(); UUID insider=attendee();
        when(projects.activeProjectsForUser(insider)).thenReturn(List.of(summary(id,"PDA"),summary(UUID.randomUUID(),"Other")));
        when(projects.activeProjectsForUser(outsider)).thenReturn(List.of(summary(UUID.randomUUID(),"Other")));
        when(projects.activeProjectsForUser(actor)).thenReturn(List.of());
        var member=service.detail(meeting.id,insider);
        assertEquals(Meeting.Kind.PROJECT,member.meetingType()); assertEquals("PDA",member.project().name()); assertEquals(id,member.project().id());
        // An invited person outside the project learns that it is a project meeting, never which project (and neither does an organizer who left it).
        for(UUID viewer:List.of(outsider,actor)) { var view=service.detail(meeting.id,viewer); assertEquals(Meeting.Kind.PROJECT,view.meetingType()); assertNull(view.project(),"project hidden from "+viewer); }
    }
    @Test void theTypeAndProjectCannotBeChangedAfterCreation() {
        UUID id=UUID.randomUUID(); meeting.projectId=id; meeting.status=Meeting.Status.SCHEDULED; meeting.startsAt=now.plusSeconds(60); meeting.endsAt=now.plusSeconds(3600);
        var base=new Command("Renamed","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),null,null,null,null);
        var toIndependent=new Command("Renamed","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),null,null,Meeting.Kind.INDEPENDENT,null);
        var otherProject=new Command("Renamed","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),null,null,Meeting.Kind.PROJECT,UUID.randomUUID());
        for(Command change:List.of(toIndependent,otherProject)) assertEquals("MEETING_TYPE_IMMUTABLE",assertThrows(MeetingException.class,()->service.update(meeting.id,actor,change)).code());
        assertEquals(id,meeting.projectId);
        // Omitting the type, or repeating it exactly, is fine.
        assertDoesNotThrow(()->service.update(meeting.id,actor,base));
        assertDoesNotThrow(()->service.update(meeting.id,actor,new Command("Again","",now.plusSeconds(60),now.plusSeconds(3600),"UTC",List.of(),Set.of(),null,null,Meeting.Kind.PROJECT,id)));
        assertEquals(id,meeting.projectId);
        // An independent meeting cannot be turned into a project one either.
        meeting.projectId=null;
        assertEquals("MEETING_TYPE_IMMUTABLE",assertThrows(MeetingException.class,()->service.update(meeting.id,actor,otherProject)).code());
    }
    @Test void searchingPeopleIsNicknameOnlyBoundedAndRateLimited() {
        UUID found=UUID.randomUUID();
        when(users.searchActiveUsers("ali",20)).thenReturn(List.of(new UserAccounts.UserSearchResult(actor,"ali-self"),new UserAccounts.UserSearchResult(found,"ali")));
        when(users.findActiveProfilesByIds(Set.of(found))).thenReturn(Map.of(found,new UserAccounts.ProfileSummary(found,"ali","A","L",3L)));
        var result=service.searchPeople(actor,"  ali ");
        assertEquals(List.of(new PersonView(found,"ali",3L)),result,"the caller never finds themselves and only id, nickname and photo version come back");
        assertEquals("MEETING_INVALID_QUERY",assertThrows(MeetingException.class,()->service.searchPeople(actor,"al")).code());
        assertEquals("MEETING_INVALID_QUERY",assertThrows(MeetingException.class,()->service.searchPeople(actor,null)).code());
        assertEquals("MEETING_INVALID_QUERY",assertThrows(MeetingException.class,()->service.searchPeople(actor,"x".repeat(65))).code());
        assertEquals(401,assertThrows(MeetingException.class,()->service.searchPeople(null,"ali")).status());
        // An address is never looked up: no query containing @ reaches the user directory, so existence of an e-mail cannot be probed.
        assertEquals(List.of(),service.searchPeople(actor,"someone@example.test"));
        verify(users,never()).searchActiveUsers(eq("someone@example.test"),anyInt());
        // 30 searches a minute per person.
        UUID busy=UUID.randomUUID();
        for(int i=0;i<30;i++) service.searchPeople(busy,"abc");
        var tooMany=assertThrows(MeetingException.class,()->service.searchPeople(busy,"abc"));
        assertEquals(429,tooMany.status()); assertEquals("MEETING_SEARCH_RATE_LIMITED",tooMany.code());
    }
    @Test void dueSchedulerOpensOnceAndOvertimeDoesNotClose() {
        meeting.status=Meeting.Status.SCHEDULED; meeting.endsAt=now.minusSeconds(1);
        lifecycle.tick(meeting.id); lifecycle.tick(meeting.id);
        assertEquals(Meeting.Status.OPEN,meeting.status); assertEquals(now,meeting.overtimeAt);
        verify(media,times(1)).createRoom(meeting.roomName,50); verify(media,never()).deleteRoom(any());
    }
    @Test void roomNeverAttendedRemainsThroughScheduledEndAndGrace() {
        meeting.endsAt=now.plusSeconds(1); meeting.emptySince=now.minusSeconds(7200);
        lifecycle.tick(meeting.id); assertEquals(Meeting.Status.OPEN,meeting.status);
    }
    @Test void endingMarksCleanupBeforeProviderAndDeletesTransientChat() {
        service.end(meeting.id,actor); // the organizer (organizerId == actor)
        assertEquals(Meeting.Status.ENDED,meeting.status); assertTrue(meeting.cleanupPending);
        verify(chats).deleteByMeetingId(meeting.id); verify(media,never()).deleteRoom(any());
        doThrow(new IllegalStateException()).when(media).deleteRoom(any()); lifecycle.tick(meeting.id);
        assertTrue(meeting.cleanupPending); assertEquals(1,meeting.cleanupAttempts); assertTrue(meeting.cleanupRetryAt.isAfter(now));
    }
    @Test void kickFailurePersistsBanAndBlocksMintUntilRotationRecovers() {
        MeetingParticipant target=new MeetingParticipant(); target.id=UUID.randomUUID(); target.meetingId=meeting.id; target.identity="user-other";
        when(participants.findById(target.id)).thenReturn(Optional.of(target));
        service.stageKick(meeting.id,actor,target.id);
        String old=meeting.roomName; doThrow(new IllegalStateException()).when(media).deleteRoom(old);
        assertFalse(lifecycle.retryRotation(meeting.id)); assertTrue(target.revoked); assertTrue(meeting.rotationPending); assertEquals(old,meeting.pendingRoomName);
        assertEquals(503,assertThrows(MeetingException.class,()->service.join(meeting.id,actor)).status());
        verify(media,never()).issueToken(anyString(),anyString(),anyString(),any());
        doNothing().when(media).deleteRoom(old); when(media.roomExists(old)).thenReturn(false); assertTrue(lifecycle.retryRotation(meeting.id));
        assertEquals(1,meeting.roomEpoch); assertNotEquals(old,meeting.roomName); assertFalse(meeting.rotationPending); assertEquals("Meeting",meeting.title);
        verify(chats,never()).deleteByMeetingId(any());
    }
    @Test void staleEpochWebhookCannotReconnectKickedIdentity() {
        when(meetings.findByRoomName("old-room")).thenReturn(Optional.empty());
        lifecycle.accept("event-old","participant_joined","old-room","guest-old",now);
        verifyNoInteractions(webhooks); verifyNoInteractions(media);
    }
    @Test void existingGuestSessionSurvivesInviteRevocation() {
        String secret="test-session"; MeetingParticipant p=new MeetingParticipant(); p.meetingId=meeting.id; p.inviteId=UUID.randomUUID(); p.sessionExpiresAt=now.plusSeconds(60);
        when(participants.findBySessionHash(MeetingService.hash(secret))).thenReturn(Optional.of(p));
        assertSame(p,service.guest(meeting,secret)); verifyNoInteractions(invites);
        p.sessionExpiresAt=now; assertThrows(MeetingException.class,()->service.guest(meeting,secret));
    }
    @Test void revokedInviteCannotIssueNewGuestSession() {
        MeetingInvite invite=new MeetingInvite(); invite.id=UUID.randomUUID(); invite.meetingId=meeting.id; invite.revoked=true; invite.expiresAt=now.plusSeconds(60); invite.maxUses=2;
        MeetingInviteRepository.InviteScope scope=mock(MeetingInviteRepository.InviteScope.class); when(scope.getId()).thenReturn(invite.id); when(scope.getMeetingId()).thenReturn(meeting.id);
        when(invites.scopeByTokenHash(anyString())).thenReturn(Optional.of(scope)); when(invites.findById(invite.id)).thenReturn(Optional.of(invite));
        assertThrows(MeetingException.class,()->service.guestSession(new GuestRequest("test-invite","Guest")));
        verify(participants,never()).save(any());
    }
    @Test void chatCannotUseDatabasePresenceWithoutMediaPresence() {
        MeetingParticipant p=new MeetingParticipant(); p.meetingId=meeting.id; p.connected=true; p.identity="user-"+actor;
        when(participants.findByMeetingIdAndIdentity(meeting.id,p.identity)).thenReturn(Optional.of(p));
        assertEquals("MEETING_PARTICIPANT_REQUIRED",assertThrows(MeetingException.class,()->service.chat(meeting.id,actor,new ChatRequest("text",Set.of()))).code());
        verify(chats,never()).save(any());
    }
    @Test void providerRestartRecreatesOnlyCurrentEpochRoomWithoutEndingMeeting() {
        when(media.roomExists(meeting.roomName)).thenReturn(false);
        lifecycle.tick(meeting.id);
        verify(media).createRoom(meeting.roomName,50); assertEquals(Meeting.Status.OPEN,meeting.status);
        assertFalse(meeting.cleanupPending); assertEquals(0,meeting.roomEpoch);
    }
}
