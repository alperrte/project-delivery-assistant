package com.pda.meeting.internal;

import com.pda.meeting.*;
import com.pda.project.*;
import org.junit.jupiter.api.*;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
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
    MeetingAuditRepository audits=mock(MeetingAuditRepository.class);
    ProjectAccess projects=mock(ProjectAccess.class);
    MeetingMediaPort media=mock(MeetingMediaPort.class);
    ApplicationEventPublisher events=mock(ApplicationEventPublisher.class);
    MeetingWebhookRepository webhooks=mock(MeetingWebhookRepository.class);
    MeetingPolicy policy=new MeetingPolicy();
    UUID project=UUID.randomUUID(),actor=UUID.randomUUID();
    Instant now=Instant.parse("2026-10-18T12:00:00Z");
    MeetingService service;
    MeetingLifecycle lifecycle;
    Meeting meeting;
    @BeforeEach void setup() {
        policy.setEnabled(true);
        service=new MeetingService(meetings,participants,invites,chats,audits,projects,media,policy,events,Clock.fixed(now,ZoneOffset.UTC));
        lifecycle=new MeetingLifecycle(service,webhooks,mock(com.pda.user.UserAccounts.class),policy,media,meetings,participants,projects,Clock.fixed(now,ZoneOffset.UTC));
        meeting=new Meeting(); meeting.id=UUID.randomUUID(); meeting.projectId=project; meeting.organizerId=actor;
        meeting.status=Meeting.Status.OPEN; meeting.roomName="pda-"+meeting.id; meeting.title="Meeting"; meeting.description="";
        meeting.startsAt=now.minusSeconds(3600); meeting.endsAt=now.plusSeconds(3600); meeting.createdAt=now;
        when(meetings.lock(meeting.id)).thenReturn(Optional.of(meeting)); when(projects.isMember(project,actor)).thenReturn(true);
        when(projects.rolesForUserInProject(project,actor)).thenReturn(Set.of());
        when(projects.members(eq(project),any())).thenReturn(Page.empty());
        when(participants.findByMeetingId(meeting.id)).thenReturn(List.of());
        when(media.listParticipants(anyString())).thenReturn(List.of());
        when(media.roomExists(anyString())).thenReturn(true);
    }
    @Test void nonManagerOrganizerCannotMuteOrKick() {
        assertEquals("MEETING_MANAGER_REQUIRED",assertThrows(MeetingException.class,()->service.mute(project,meeting.id,actor,UUID.randomUUID())).code());
        assertEquals("MEETING_MANAGER_REQUIRED",assertThrows(MeetingException.class,()->service.stageKick(project,meeting.id,actor,UUID.randomUUID())).code());
        assertEquals("MEETING_MANAGER_REQUIRED",assertThrows(MeetingException.class,()->service.end(project,meeting.id,actor)).code());
        verifyNoInteractions(media);
    }
    @Test void globalRoleNeverBypassesMembership() {
        when(projects.isMember(project,actor)).thenReturn(false);
        assertEquals(403,assertThrows(MeetingException.class,()->service.detail(project,meeting.id,actor)).status());
        verify(meetings,never()).lock(any());
    }
    @Test void changingMeetingProjectIdDoesNotGrantRead() {
        meeting.projectId=UUID.randomUUID();
        assertEquals(404,assertThrows(MeetingException.class,()->service.detail(project,meeting.id,actor)).status());
    }
    @Test void pastAndOverlongSchedulesRejected() {
        var past=new Command("Title","",now.minusSeconds(10),now.plusSeconds(10),"UTC",List.of(),Set.of());
        assertThrows(MeetingException.class,()->service.create(project,actor,past));
        var overlong=new Command("Title","",now.plusSeconds(10),now.plus(Duration.ofHours(25)),"UTC",List.of(),Set.of());
        assertThrows(MeetingException.class,()->service.create(project,actor,overlong));
        var controlText=new Command("Title\u0000","",now.plusSeconds(10),now.plusSeconds(60),"UTC",List.of(),Set.of());
        assertEquals(400,assertThrows(MeetingException.class,()->service.create(project,actor,controlText)).status());
        verify(meetings,never()).save(any());
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
        when(projects.rolesForUserInProject(project,actor)).thenReturn(Set.of("PROJECT_MANAGER"));
        service.end(project,meeting.id,actor);
        assertEquals(Meeting.Status.ENDED,meeting.status); assertTrue(meeting.cleanupPending);
        verify(chats).deleteByMeetingId(meeting.id); verify(media,never()).deleteRoom(any());
        doThrow(new IllegalStateException()).when(media).deleteRoom(any()); lifecycle.tick(meeting.id);
        assertTrue(meeting.cleanupPending); assertEquals(1,meeting.cleanupAttempts); assertTrue(meeting.cleanupRetryAt.isAfter(now));
    }
    @Test void kickFailurePersistsBanAndBlocksMintUntilRotationRecovers() {
        when(projects.rolesForUserInProject(project,actor)).thenReturn(Set.of("PROJECT_MANAGER"));
        MeetingParticipant target=new MeetingParticipant(); target.id=UUID.randomUUID(); target.meetingId=meeting.id; target.identity="user-other";
        when(participants.findById(target.id)).thenReturn(Optional.of(target));
        service.stageKick(project,meeting.id,actor,target.id);
        String old=meeting.roomName; doThrow(new IllegalStateException()).when(media).deleteRoom(old);
        assertFalse(lifecycle.retryRotation(meeting.id)); assertTrue(target.revoked); assertTrue(meeting.rotationPending); assertEquals(old,meeting.pendingRoomName);
        assertEquals(503,assertThrows(MeetingException.class,()->service.join(project,meeting.id,actor)).status());
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
        assertEquals("MEETING_PARTICIPANT_REQUIRED",assertThrows(MeetingException.class,()->service.chat(project,meeting.id,actor,new ChatRequest("text",Set.of()))).code());
        verify(chats,never()).save(any());
    }
    @Test void providerRestartRecreatesOnlyCurrentEpochRoomWithoutEndingMeeting() {
        when(media.roomExists(meeting.roomName)).thenReturn(false);
        lifecycle.tick(meeting.id);
        verify(media).createRoom(meeting.roomName,50); assertEquals(Meeting.Status.OPEN,meeting.status);
        assertFalse(meeting.cleanupPending); assertEquals(0,meeting.roomEpoch);
    }
}
