package com.pda.meeting.internal;

import com.pda.BackendApplication;
import com.pda.meeting.*;
import com.pda.project.ProjectDeletedEvent;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.security.SecureRandom;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.pda.meeting.internal.MeetingDtos.*;

@SpringBootTest(classes=BackendApplication.class,properties={"pda.meeting.enabled=true","API_DOCS_ENABLED=true","springdoc.api-docs.enabled=true","springdoc.swagger-ui.enabled=true"})
@AutoConfigureMockMvc
@Testcontainers @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MeetingCoreIntegrationTest {
    @Container static PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:18-alpine");
    static final byte[] KEY=new byte[32]; static { new SecureRandom().nextBytes(KEY); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",postgres::getJdbcUrl); r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword); r.add("JWT_SECRET",()->Base64.getEncoder().encodeToString(KEY));
        r.add("FRONTEND_URL",()->"http://localhost:3000");
    }
    @MockitoBean MeetingMediaPort media;
    @Autowired MeetingService service;
    @Autowired MeetingLifecycle lifecycle;
    @Autowired MeetingModeration moderation;
    @Autowired MeetingRepository meetings;
    @Autowired MeetingRoomCleanupRepository cleanup;
    @Autowired JdbcTemplate db;
    @Autowired TransactionTemplate tx;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired MockMvc mvc;
    UUID actor,project;
    @BeforeEach void fixture() {
        reset(media); when(media.roomExists(anyString())).thenReturn(true); when(media.listParticipants(anyString())).thenReturn(List.of());
        actor=user("USER"); project=UUID.randomUUID();
        db.update("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES (?,'Meeting test',?,'ACTIVE','MEDIUM','PRIVATE',?,now(),now())",project,project.toString(),actor);
        UUID member=UUID.randomUUID(); db.update("INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES (?,?,?,now())",member,project,actor);
        db.update("INSERT INTO project_membership_roles(membership_id,role) VALUES (?,'PROJECT_MANAGER')",member);
    }
    @Test void replicasSerializeDueOpeningAndOvertimeWarning() throws Exception {
        UUID id=scheduled(); db.update("UPDATE meetings SET starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' WHERE id=?",id);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var start=new CountDownLatch(1);
            var a=executor.submit(()->{await(start); lifecycle.tick(id);}); var b=executor.submit(()->{await(start); lifecycle.tick(id);}); start.countDown();
            a.get(20,TimeUnit.SECONDS); b.get(20,TimeUnit.SECONDS);
        }
        verify(media,times(1)).createRoom("pda-"+id,50);
        assertEquals("OPEN",db.queryForObject("SELECT status FROM meetings WHERE id=?",String.class,id));
        assertEquals(1,db.queryForObject("SELECT count(*) FROM notifications WHERE resource_id=? AND type='MEETING_OPENED'",Integer.class,id));
        assertEquals(1,db.queryForObject("SELECT count(*) FROM notifications WHERE resource_id=? AND type='MEETING_OVERTIME'",Integer.class,id));
        verify(media,never()).deleteRoom(anyString());
    }
    @Test void failedOpenRollsBackAndRestartPassRecovers() {
        UUID id=scheduled(); db.update("UPDATE meetings SET starts_at=now()-interval '1 minute' WHERE id=?",id);
        doThrow(new IllegalStateException("TEST-ONLY media outage")).when(media).createRoom(anyString(),anyInt());
        assertThrows(RuntimeException.class,()->lifecycle.tick(id));
        assertEquals("SCHEDULED",db.queryForObject("SELECT status FROM meetings WHERE id=?",String.class,id));
        doNothing().when(media).createRoom(anyString(),anyInt()); lifecycle.tick(id);
        assertEquals("OPEN",db.queryForObject("SELECT status FROM meetings WHERE id=?",String.class,id));
    }
    @Test void failedKickDurablyBlocksMintAndWorkerRecoversWithoutLosingHistory() {
        UUID id=scheduled(); service.start(project,id,actor);
        UUID target=participant(id); String old="pda-"+id;
        doThrow(new IllegalStateException("TEST-ONLY delete outage")).when(media).deleteRoom(old);
        assertThrows(MeetingException.class,()->moderation.kick(project,id,actor,target));
        assertTrue(db.queryForObject("SELECT revoked FROM meeting_participants WHERE id=?",Boolean.class,target));
        assertTrue(db.queryForObject("SELECT rotation_pending FROM meetings WHERE id=?",Boolean.class,id));
        assertEquals(503,assertThrows(MeetingException.class,()->service.join(project,id,actor)).status());
        doNothing().when(media).deleteRoom(old); when(media.roomExists(old)).thenReturn(false); lifecycle.tick(id);
        assertEquals(1,db.queryForObject("SELECT room_epoch FROM meetings WHERE id=?",Integer.class,id));
        assertEquals("Meeting test",service.detail(project,id,actor).title());
        assertEquals(1,db.queryForObject("SELECT count(*) FROM meeting_agenda WHERE meeting_id=?",Integer.class,id));
        lifecycle.accept("stale-"+UUID.randomUUID(),"participant_joined",old,"user-"+actor,Instant.now());
        assertFalse(db.queryForObject("SELECT connected FROM meeting_participants WHERE id=?",Boolean.class,target));
    }
    @Test void inviteRevocationPreservesExistingGuestScopeAndUseCount() {
        UUID id=scheduled(); service.start(project,id,actor);
        var invitation=service.invite(project,id,actor,new InviteRequest(Instant.now().plusSeconds(3600),1));
        var session=service.guestSession(new GuestRequest(invitation.token(),"Guest"));
        service.revokeInvite(project,id,actor,invitation.id());
        assertThrows(MeetingException.class,()->service.guestSession(new GuestRequest(invitation.token(),"Other")));
        when(media.issueToken(anyString(),anyString(),anyString(),any())).thenReturn(new MeetingMediaPort.MediaJoin("wss://example.test","TEST-ONLY",Instant.now().plusSeconds(60)));
        assertEquals(session.participantId(),service.guestJoin(id,session.secret()).participantId());
        assertEquals(1,db.queryForObject("SELECT uses FROM meeting_invites WHERE id=?",Integer.class,invitation.id()));
        assertThrows(MeetingException.class,()->service.guestJoin(UUID.randomUUID(),session.secret()));
    }
    @Test void globalAdminOutsideProjectCannotJoinOrModerate() {
        UUID id=scheduled(),outsider=user("ADMIN");
        assertEquals(403,assertThrows(MeetingException.class,()->service.join(project,id,outsider)).status());
        assertEquals(403,assertThrows(MeetingException.class,()->service.mute(project,id,outsider,UUID.randomUUID())).status());
    }
    @Test void projectDeleteCascadesHistoryButLeavesIndependentCleanupTombstone() {
        UUID id=scheduled(); service.start(project,id,actor); String room="pda-"+id;
        tx.executeWithoutResult(s->{ publisher.publishEvent(new ProjectDeletedEvent(project,actor)); db.update("DELETE FROM projects WHERE id=?",project); });
        assertFalse(meetings.existsById(id)); assertTrue(cleanup.existsById(room));
    }
    @Test void membershipRemovalQueuesOneDurableRotationAndNoParticipantNeedsNone() {
        UUID id=scheduled(); service.start(project,id,actor); UUID p=participant(id);
        tx.executeWithoutResult(s->publisher.publishEvent(new com.pda.project.ProjectMemberRemovedEvent(project,actor,actor,Instant.now())));
        assertTrue(db.queryForObject("SELECT revoked FROM meeting_participants WHERE id=?",Boolean.class,p));
        assertTrue(db.queryForObject("SELECT rotation_pending FROM meetings WHERE id=?",Boolean.class,id));
        String old="pda-"+id; when(media.roomExists(old)).thenReturn(false); lifecycle.tick(id);
        assertEquals(1,db.queryForObject("SELECT room_epoch FROM meetings WHERE id=?",Integer.class,id));
        UUID noParticipant=scheduled(); service.start(project,noParticipant,actor);
        tx.executeWithoutResult(s->publisher.publishEvent(new com.pda.project.ProjectMemberRemovedEvent(project,UUID.randomUUID(),actor,Instant.now())));
        assertFalse(db.queryForObject("SELECT rotation_pending FROM meetings WHERE id=?",Boolean.class,noParticipant));
    }
    @Test void concurrentSingleUseInviteHasExactlyOneRedemption() throws Exception {
        UUID id=scheduled(); service.start(project,id,actor);
        var invitation=service.invite(project,id,actor,new InviteRequest(Instant.now().plusSeconds(3600),1));
        var successes=new java.util.concurrent.atomic.AtomicInteger();
        try(var executor=Executors.newFixedThreadPool(2)) {
            var start=new CountDownLatch(1); Runnable redeem=()->{await(start); try { service.guestSession(new GuestRequest(invitation.token(),"Guest")); successes.incrementAndGet(); } catch(MeetingException expected) { assertEquals("MEETING_INVITE_INVALID",expected.code()); }};
            var a=executor.submit(redeem); var b=executor.submit(redeem); start.countDown(); a.get(20,TimeUnit.SECONDS); b.get(20,TimeUnit.SECONDS);
        }
        assertEquals(1,successes.get()); assertEquals(1,db.queryForObject("SELECT uses FROM meeting_invites WHERE id=?",Integer.class,invitation.id()));
        assertEquals(1,db.queryForObject("SELECT count(*) FROM meeting_participants WHERE invite_id=?",Integer.class,invitation.id()));
    }
    @Test void expiredGuestWithMintedMediaRotatesButUnusedSessionDoesNot() {
        UUID id=scheduled(); service.start(project,id,actor);
        var invitation=service.invite(project,id,actor,new InviteRequest(Instant.now().plusSeconds(3600),2));
        var unused=service.guestSession(new GuestRequest(invitation.token(),"Unused"));
        db.update("UPDATE meeting_participants SET session_expires_at=now()-interval '1 second' WHERE id=?",unused.participantId());
        lifecycle.tick(id); assertEquals(0,db.queryForObject("SELECT room_epoch FROM meetings WHERE id=?",Integer.class,id));
        var live=service.guestSession(new GuestRequest(invitation.token(),"Live")); service.guestJoin(id,live.secret());
        db.update("UPDATE meeting_participants SET session_expires_at=now()-interval '1 second' WHERE id=?",live.participantId());
        when(media.roomExists("pda-"+id)).thenReturn(false); lifecycle.tick(id);
        assertEquals(1,db.queryForObject("SELECT room_epoch FROM meetings WHERE id=?",Integer.class,id));
        assertTrue(db.queryForObject("SELECT revoked FROM meeting_participants WHERE id=?",Boolean.class,live.participantId()));
    }
    @Test void redemptionWaitingForRevocationLockReadsCommittedInviteState() throws Exception {
        UUID id=scheduled(); service.start(project,id,actor);
        var invitation=service.invite(project,id,actor,new InviteRequest(Instant.now().plusSeconds(3600),5));
        var revokedInsideTransaction=new CountDownLatch(1); var releaseCommit=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var revocation=executor.submit(()->tx.executeWithoutResult(s->{service.revokeInvite(project,id,actor,invitation.id()); revokedInsideTransaction.countDown(); await(releaseCommit);}));
            assertTrue(revokedInsideTransaction.await(10,TimeUnit.SECONDS));
            var redemption=executor.submit(()->assertThrows(MeetingException.class,()->service.guestSession(new GuestRequest(invitation.token(),"Guest"))));
            releaseCommit.countDown(); revocation.get(20,TimeUnit.SECONDS); assertEquals("MEETING_INVITE_INVALID",redemption.get(20,TimeUnit.SECONDS).code());
        } finally { releaseCommit.countDown(); }
        assertEquals(0,db.queryForObject("SELECT uses FROM meeting_invites WHERE id=?",Integer.class,invitation.id()));
    }
    @Test void generatedOpenApiContainsActualRoutesAndDistinctMeetingSchemas() throws Exception {
        var result=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/v3/api-docs"))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andReturn();
        String body=result.getResponse().getContentAsString();
        Map<String,Object> paths=com.jayway.jsonpath.JsonPath.read(body,"$.paths");
        assertTrue(paths.containsKey("/api/v1/projects/{projectId}/meetings"));
        assertTrue(paths.containsKey("/api/v1/projects/{projectId}/meetings/calendar"));
        assertTrue(paths.containsKey("/api/v1/projects/{projectId}/meetings/{meetingId}/participants/{participantId}/kick"));
        assertTrue(paths.containsKey("/api/v1/meetings/guest/session"));
        assertTrue(paths.containsKey("/api/v1/meetings/guest/{meetingId}/join"));
        assertTrue(paths.containsKey("/api/v1/meetings/media/webhook"));
        Map<String,Object> view=com.jayway.jsonpath.JsonPath.read(body,"$.components.schemas.MeetingView.properties");
        assertTrue(view.containsKey("roomEpoch")); assertTrue(view.containsKey("reconnectRequired")); assertTrue(view.containsKey("cleanupPending"));
        Map<String,Object> participant=com.jayway.jsonpath.JsonPath.read(body,"$.components.schemas.MeetingParticipantView.properties");
        assertTrue(participant.containsKey("identity"));
        String responseRef=com.jayway.jsonpath.JsonPath.read(body,"$.paths['/api/v1/meetings/guest/session'].post.responses['201'].content['*/*'].schema['$ref']");
        String schemaName=responseRef.substring(responseRef.lastIndexOf('/')+1);
        Map<String,Object> guestView=com.jayway.jsonpath.JsonPath.read(body,"$.components.schemas['"+schemaName+"'].properties");
        assertFalse(guestView.containsKey("secret")); assertFalse(guestView.containsKey("token"));
    }
    @Test void calendarRangeIncludesMeetingsAlreadyInProgress() {
        UUID id=scheduled();
        Instant from=Instant.now().plusSeconds(600),to=from.plusSeconds(600);
        var page=service.list(project,actor,null,from,to,0,100,"startsAt,asc");
        assertTrue(page.content().stream().anyMatch(m->m.id().equals(id)),"A meeting spanning the range start belongs on the calendar");
        assertTrue(service.list(project,actor,null,to.plusSeconds(7200),to.plusSeconds(7800),0,100,"startsAt,asc").content().isEmpty());
    }
    @Test void chatMentionsPersistOnlyForLiveMeetingParticipantsAndDefaultEndDeletesContent() {
        UUID id=scheduled(); service.start(project,id,actor); UUID author=participant(id);
        var invitation=service.invite(project,id,actor,new InviteRequest(Instant.now().plusSeconds(3600),1));
        var guest=service.guestSession(new GuestRequest(invitation.token(),"Guest"));
        db.update("UPDATE meeting_participants SET connected=true WHERE id=?",guest.participantId());
        when(media.listParticipants("pda-"+id)).thenReturn(List.of(
            new MeetingMediaPort.MediaParticipant("user-"+actor,"Member"),
            new MeetingMediaPort.MediaParticipant("guest-"+guest.participantId(),"Guest")));
        assertEquals("MEETING_INVALID_MENTIONS",assertThrows(MeetingException.class,
            ()->service.chat(project,id,actor,new ChatRequest("Hello",Set.of(UUID.randomUUID())))).code());
        assertEquals("MEETING_INVALID_MESSAGE",assertThrows(MeetingException.class,
            ()->service.chat(project,id,actor,new ChatRequest("<script>example</script>",Set.of()))).code());
        var message=service.chat(project,id,actor,new ChatRequest("Hello @Guest",Set.of(guest.participantId())));
        assertEquals(author,message.participantId());
        assertEquals(Set.of(guest.participantId()),message.mentionIds());
        assertEquals(1,service.history(project,id,actor,0,50).totalElements());
        assertEquals(1,db.queryForObject("SELECT count(*) FROM meeting_chat_mentions WHERE message_id=?",Integer.class,message.id()));
        verify(media).sendData(eq("pda-"+id),argThat(bytes->new String(bytes,java.nio.charset.StandardCharsets.UTF_8).contains(message.id().toString())));
        service.end(project,id,actor);
        assertEquals(0,db.queryForObject("SELECT count(*) FROM meeting_chat_messages WHERE meeting_id=?",Integer.class,id));
        assertEquals(0,db.queryForObject("SELECT count(*) FROM meeting_chat_mentions WHERE message_id=?",Integer.class,message.id()));
    }
    private UUID scheduled() { return service.create(project,actor,new Command("Meeting test","",Instant.now().plusSeconds(60),Instant.now().plusSeconds(3660),"Europe/Istanbul",List.of("Agenda"),Set.of())).id(); }
    private UUID participant(UUID id) { UUID participant=UUID.randomUUID(); db.update("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name,revoked,connected) VALUES (?,?,?,?, 'Member',false,true)",participant,id,actor,"user-"+actor); return participant; }
    private UUID user(String role) { UUID id=UUID.randomUUID(); db.update("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES (?,?,?,'ACTIVE','VERIFIED',?,now(),now())",id,id+"@example.test",id.toString().substring(0,20),role); return id; }
    private static void await(CountDownLatch start) { try { start.await(); } catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); } }
}
