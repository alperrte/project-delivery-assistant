package com.pda.meeting.internal;

import com.pda.BackendApplication;
import com.pda.meeting.*;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.*;
import com.pda.shared.testing.TestPostgres;
import org.testcontainers.utility.DockerImageName;
import java.net.*;
import java.net.http.*;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static com.pda.meeting.internal.MeetingDtos.*;

@SpringBootTest(classes=BackendApplication.class,properties={"pda.meeting.enabled=true","MAIL_ENABLED=false"})
@Import(MeetingReminderIntegrationTest.TestTime.class)
@Testcontainers @DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MeetingReminderIntegrationTest {
    @Container static TestPostgres postgres=new TestPostgres("postgres:18-alpine");
    @Container static GenericContainer<?> mailpit=new GenericContainer<>(DockerImageName.parse("axllent/mailpit:v1.31.4")).withExposedPorts(1025,8025);
    static final byte[] KEY=new byte[32]; static { new SecureRandom().nextBytes(KEY); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",postgres::getJdbcUrl); r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword); r.add("JWT_SECRET",()->Base64.getEncoder().encodeToString(KEY));
        r.add("FRONTEND_URL",()->"http://localhost:3001");
    }
    @Autowired MutableClock clock;
    @MockitoBean MeetingMediaPort media;
    @MockitoBean MeetingScheduler lifecycleScheduler;
    @MockitoBean MeetingReminderScheduler reminderScheduler;
    @MockitoBean MeetingReminderMail mail;
    @Autowired MeetingService service;
    @Autowired MeetingReminderStore store;
    @Autowired MeetingReminderDispatcher dispatcher;
    @Autowired MeetingPolicy policy;
    @Autowired UserAccounts accounts;
    @Autowired JdbcTemplate db;
    Instant now=Instant.parse("2026-10-25T12:00:00Z");
    UUID owner,attendee,other,project;

    @BeforeEach void fixture() {
        reset(mail); clock.source=()->now;
        when(mail.available()).thenReturn(true);
        db.update("DELETE FROM projects"); owner=user(); attendee=user(); other=user(); project=UUID.randomUUID();
        db.update("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES (?,'Reminder QA',?,'ACTIVE','MEDIUM','PRIVATE',?,now(),now())",project,project.toString(),owner);
        for(UUID user:List.of(owner,attendee,other)) {
            UUID member=UUID.randomUUID(); db.update("INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES (?,?,?,now())",member,project,user);
            db.update("INSERT INTO project_membership_roles(membership_id,role) VALUES (?,'PROJECT_MANAGER')",member);
        }
    }
    UUID user() {
        UUID id=UUID.randomUUID();
        db.update("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES (?,?,?,'ACTIVE','VERIFIED','USER',now(),now())",id,id+"@example.test","QA"+id.toString().substring(0,8));
        return id;
    }
    UUID meeting(long seconds) { return service.create(project,owner,command(now.plusSeconds(seconds),Set.of(owner,attendee))).id(); }
    Command command(Instant start,Set<UUID> recipients) { return new Command("Reminder QA", "",start,start.plusSeconds(3600),"Europe/Istanbul",List.of(),recipients); }
    void move(UUID id,long seconds,Set<UUID> recipients) { service.update(project,id,owner,command(now.plusSeconds(seconds),recipients)); }
    int count(String status) { return db.queryForObject("SELECT count(*) FROM meeting_reminder_deliveries WHERE status=?",Integer.class,status); }
    void sends(int n) { verify(mail,times(n)).send(any()); }

    @Test void dayAheadIsDurableButNotYetSent() {
        UUID id=meeting(86400); dispatcher.dispatch(); sends(0); assertEquals(2,count("PENDING"));
        assertEquals(now.plusSeconds(82800),db.queryForObject("SELECT reminder_at FROM meeting_reminder_deliveries WHERE meeting_id=? LIMIT 1",Timestamp.class,id).toInstant());
    }
    @Test void exactlyOneHourSendsOnceToDeduplicatedInviteesOnly() {
        meeting(3600); dispatcher.dispatch(); dispatcher.dispatch(); sends(2); assertEquals(2,count("SENT"));
        verify(mail,never()).send(argThat(e->e.recipient().email().equals(other+"@example.test")));
    }
    @Test void halfHourMeetingSendsOnFirstPassOutsideAnyTransaction() {
        meeting(1800); doAnswer(i->{assertFalse(TransactionSynchronizationManager.isActualTransactionActive());return null;}).when(mail).send(any());
        dispatcher.dispatch(); sends(2);
    }
    @Test void overdueScheduledMeetingCannotSendEvenIfLifecycleHasNotOpenedIt() {
        meeting(1800); store.reconcile(); now=now.plusSeconds(1801); dispatcher.dispatch(); sends(0); assertEquals(2,count("CANCELLED"));
    }
    @Test void cancelledMeetingInvalidatesWaitingJobs() {
        UUID id=meeting(1800); store.reconcile(); service.cancel(project,id,owner); dispatcher.dispatch(); sends(0); assertEquals(2,count("CANCELLED"));
    }
    @Test void postponingRecalculatesDueTimeAndCancelsOldRevision() {
        UUID id=meeting(3600); store.reconcile(); move(id,18000,Set.of(owner,attendee)); dispatcher.dispatch(); sends(0);
        assertEquals(2,count("CANCELLED")); assertEquals(2,count("PENDING")); now=now.plusSeconds(14400); dispatcher.dispatch(); sends(2);
    }
    @Test void movingEarlierMakesNewRevisionImmediatelyEligible() {
        UUID id=meeting(86400); store.reconcile(); move(id,1800,Set.of(owner,attendee)); dispatcher.dispatch(); sends(2); assertEquals(2,count("CANCELLED"));
    }
    /** The reminder moment is an absolute instant exactly 60 minutes before the start, whatever the meeting's zone or a daylight-saving change in between. */
    @ParameterizedTest @CsvSource({
            "Europe/Istanbul,2026-10-23T14:30,2026-10-23T11:30:00Z,14:30 +03:00",
            "Europe/Berlin,2026-10-23T14:30,2026-10-23T12:30:00Z,14:30 +02:00",
            "Europe/London,2026-10-23T14:30,2026-10-23T13:30:00Z,14:30 +01:00",
            "America/New_York,2026-10-23T14:30,2026-10-23T18:30:00Z,14:30 -04:00",
            "UTC,2026-10-23T14:30,2026-10-23T14:30:00Z,14:30 Z",
            "Europe/Berlin,2026-10-25T04:00,2026-10-25T03:00:00Z,04:00 +01:00",
            "Europe/London,2026-03-29T02:30,2026-03-29T01:30:00Z,02:30 +01:00",
            "America/New_York,2026-11-01T08:00,2026-11-01T13:00:00Z,08:00 -05:00",
            "America/New_York,2026-03-08T03:30,2026-03-08T07:30:00Z,03:30 -04:00"})
    void reminderIsExactlySixtyMinutesBeforeTheRealStartInEveryZone(String zone,String local,String utc,String displayed) {
        Instant start=ZonedDateTime.of(LocalDateTime.parse(local),ZoneId.of(zone)).toInstant();
        assertEquals(Instant.parse(utc),start,"the local start is the expected UTC instant");
        now=start.minusSeconds(7200);
        UUID id=service.create(project,owner,new Command("Zone meeting","",start,start.plusSeconds(3600),zone,List.of(),Set.of(attendee))).id();
        store.reconcile();
        assertEquals(start.minusSeconds(3600),db.queryForObject("SELECT reminder_at FROM meeting_reminder_deliveries WHERE meeting_id=? LIMIT 1",Timestamp.class,id).toInstant(),"stored reminder instant");
        assertEquals(start,db.queryForObject("SELECT starts_at FROM meetings WHERE id=?",Timestamp.class,id).toInstant(),"stored start instant");
        now=start.minusSeconds(3601); dispatcher.dispatch(); sends(0);               // one second early: nothing is sent
        now=start.minusSeconds(3600); dispatcher.dispatch(); sends(2);               // on the minute: the organizer and the attendee, once each
        dispatcher.dispatch(); sends(2);
        verify(mail,times(2)).send(argThat(e->e.startsAt().equals(start) && SmtpMeetingReminderMail.render("https://pd-assistant.com",e).text().contains(displayed)));
    }
    @Test void newlyAddedAttendeeUsesNewPlanningRevision() {
        UUID id=meeting(86400); store.reconcile(); move(id,1800,Set.of(owner,attendee,other)); dispatcher.dispatch(); sends(3);
        assertEquals(2,count("CANCELLED")); assertEquals(3,count("SENT"));
    }
    @Test void removedInviteeCannotReceiveOldJob() {
        UUID id=meeting(86400); store.reconcile(); move(id,1800,Set.of(owner)); dispatcher.dispatch(); sends(1);
        verify(mail,never()).send(argThat(e->e.recipient().email().equals(attendee+"@example.test")));
    }
    @Test void oneUserMayReceiveIndependentMeetingReminders() {
        meeting(1800); meeting(2400); dispatcher.dispatch(); sends(4); assertEquals(4,count("SENT"));
    }
    @Test void concurrentSchedulersClaimEachRecipientOnce() throws Exception {
        meeting(1800);
        try(var pool=Executors.newFixedThreadPool(2)) {
            CountDownLatch start=new CountDownLatch(1);
            var a=pool.submit(()->{await(start);dispatcher.dispatch();}); var b=pool.submit(()->{await(start);dispatcher.dispatch();});
            start.countDown(); a.get(30,TimeUnit.SECONDS); b.get(30,TimeUnit.SECONDS);
        }
        sends(2); assertEquals(2,count("SENT"));
    }
    @Test void temporarySmtpOutageBacksOffAndRecovers() {
        meeting(1800); doThrow(new org.springframework.mail.MailSendException("TEST-ONLY outage")).when(mail).send(any());
        dispatcher.dispatch(); sends(2); assertEquals(2,count("RETRY")); dispatcher.dispatch(); sends(2);
        doNothing().when(mail).send(any()); now=now.plusSeconds(30); dispatcher.dispatch(); sends(4); assertEquals(2,count("SENT"));
        assertEquals(2,db.queryForObject("SELECT min(attempts) FROM meeting_reminder_deliveries",Integer.class));
    }
    @Test void cancellationWhileWaitingForRetryStopsDelivery() {
        UUID id=meeting(1800); doThrow(new org.springframework.mail.MailSendException("TEST-ONLY outage")).when(mail).send(any());
        dispatcher.dispatch(); service.cancel(project,id,owner); now=now.plusSeconds(60); dispatcher.dispatch(); sends(2); assertEquals(2,count("CANCELLED"));
    }
    String reason(String code) { return db.queryForObject("SELECT count(*)||'' FROM meeting_reminder_deliveries WHERE error_code=?",String.class,code); }
    @Test void organizerAndEveryInvitedMemberEachGetOneMailEvenWhenTheOrganizerIsAlsoListed() {
        // Three real recipients: the organizer (also present in the attendee list), attendee A and attendee B.
        service.create(project,owner,command(now.plusSeconds(1800),Set.of(owner,attendee,other))); dispatcher.dispatch(); dispatcher.dispatch();
        sends(3); assertEquals(3,count("SENT"));
        for(UUID user:List.of(owner,attendee,other)) verify(mail,times(1)).send(argThat(e->e.recipient().email().equals(user+"@example.test")));
    }
    @Test void aSkippedRecipientIsRecordedWithTheReasonInsteadOfVanishing() {
        UUID unverified=user(), removed=user(), revoked=user(), gone=user();
        db.update("UPDATE users SET email_verification_status='PENDING' WHERE id=?",unverified);
        for(UUID user:List.of(unverified,revoked,gone)) { UUID member=UUID.randomUUID(); db.update("INSERT INTO project_memberships(id,project_id,user_id,joined_at) VALUES (?,?,?,now())",member,project,user); }
        // `removed` is invited but not a project member; `gone` is a member that is later removed from the project.
        UUID id=service.create(project,owner,command(now.plusSeconds(1800),Set.of(attendee,unverified,revoked,gone))).id();
        db.update("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name,revoked) VALUES (?,?,?,?,?,true)",UUID.randomUUID(),id,revoked,"user-"+revoked,"QA participant");
        db.update("DELETE FROM project_memberships WHERE project_id=? AND user_id=?",project,gone);
        db.update("INSERT INTO meeting_attendees(meeting_id,user_id) VALUES (?,?)",id,removed); store.reconcile();
        dispatcher.dispatch();
        assertEquals("1",reason("RECIPIENT_UNAVAILABLE")); assertEquals("2",reason("NOT_A_PROJECT_MEMBER")); assertEquals("1",reason("REMOVED_FROM_MEETING"));
        sends(2); // the organizer and the one healthy attendee
    }
    @Test void disabledAccountIsExcludedByUserPublicContract() {
        meeting(1800); db.update("UPDATE users SET account_status='DISABLED' WHERE id=?",attendee); dispatcher.dispatch(); sends(1); assertEquals(1,count("CANCELLED"));
    }
    @Test void unverifiedAddressIsExcludedAndSavedLocaleComesFromUserModule() {
        meeting(1800); db.update("UPDATE users SET email_verification_status='PENDING' WHERE id=?",attendee);
        db.update("INSERT INTO user_preferences(user_id,locale,updated_at) VALUES (?,'de',now())",owner);
        assertTrue(accounts.findVerifiedMailRecipient(attendee).isEmpty()); dispatcher.dispatch(); sends(1);
        verify(mail).send(argThat(e->e.recipient().locale().equals("de"))); assertEquals(1,count("CANCELLED"));
    }
    @Test void removedProjectAccessPreventsSending() {
        meeting(1800); db.update("DELETE FROM project_memberships WHERE project_id=? AND user_id=?",project,attendee);
        dispatcher.dispatch(); sends(1); assertEquals(1,count("CANCELLED"));
    }
    @Test void archivedProjectCannotLeakMeetingDetailsByMail() {
        meeting(1800); db.update("UPDATE projects SET status='ARCHIVED',archived_at=now() WHERE id=?",project);
        dispatcher.dispatch(); sends(0); assertEquals(2,count("CANCELLED"));
    }
    @Test void revokedMeetingParticipantIsExcludedEvenWithProjectMembership() {
        UUID id=meeting(1800);
        db.update("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name,revoked) VALUES (?,?,?,?,?,true)",UUID.randomUUID(),id,attendee,"user-"+attendee,"QA participant");
        dispatcher.dispatch(); sends(1); assertEquals(1,count("CANCELLED"));
    }
    @ParameterizedTest @CsvSource({"2026-03-29T00:30:00Z,01:30 +01:00","2026-03-29T01:30:00Z,03:30 +02:00","2026-10-25T00:30:00Z,02:30 +02:00","2026-10-25T01:30:00Z,02:30 +01:00"})
    void absoluteDueTimeSurvivesBothDaylightSavingTransitions(String instant,String displayed) {
        Instant start=Instant.parse(instant); now=start.minusSeconds(3600);
        service.create(project,owner,new Command("DST meeting","",start,start.plusSeconds(3600),"Europe/Berlin",List.of(),Set.of(attendee)));
        dispatcher.dispatch(); sends(2);
        verify(mail,times(2)).send(argThat(e->e.startsAt().equals(start)
                && SmtpMeetingReminderMail.render("https://pd-assistant.com",e).text().contains(displayed)));
    }
    @Test void restartRecoversExpiredClaimsAndFencesStaleWorker() {
        meeting(1800); store.reconcile(); var abandoned=store.claim().orElseThrow();
        now=now.plusSeconds(121); var recovered=store.claim().orElseThrow();
        // Force the old worker's completion to race a newer lease on that same delivery.
        assertEquals(abandoned.id(),recovered.id()); store.sent(abandoned); assertEquals(0,count("SENT"));
        mail.send(store.prepare(recovered).orElseThrow()); store.sent(recovered);
        new MeetingReminderDispatcher(store,mail,policy).dispatch();
        assertEquals(0,count("SENDING")); assertEquals(2,count("SENT")); sends(2);
    }
    @Test void successfulSmtpWithLostCommitIsRecoveredAtLeastOnce() {
        meeting(1800); var failingStore=mock(MeetingReminderStore.class,org.mockito.AdditionalAnswers.delegatesTo(store));
        doThrow(new IllegalStateException("TEST-ONLY commit loss")).when(failingStore).sent(any());
        new MeetingReminderDispatcher(failingStore,mail,policy).dispatch(); sends(2); assertEquals(2,count("SENDING"));
        now=now.plusSeconds(121); dispatcher.dispatch(); sends(4); assertEquals(2,count("SENT"));
    }
    @Test void retriesStopAtMeetingStart() {
        meeting(60); doThrow(new org.springframework.mail.MailSendException("TEST-ONLY outage")).when(mail).send(any()); dispatcher.dispatch();
        now=now.plusSeconds(61); dispatcher.dispatch(); sends(2); assertEquals(2,count("CANCELLED"));
    }
    @Test void permanentSmtpFailureDoesNotRetry() {
        meeting(1800); doThrow(new org.springframework.mail.MailAuthenticationException("TEST-ONLY auth rejection")).when(mail).send(any());
        dispatcher.dispatch(); now=now.plusSeconds(60); dispatcher.dispatch(); sends(2); assertEquals(2,count("FAILED"));
    }
    @Test void retryAttemptsAreBounded() {
        meeting(3600); doThrow(new org.springframework.mail.MailSendException("TEST-ONLY outage")).when(mail).send(any());
        for(int attempt=0;attempt<8;attempt++) { dispatcher.dispatch(); now=now.plusSeconds(Math.min(900,30L<<Math.min(attempt,5))); }
        sends(16); assertEquals(2,count("FAILED")); assertEquals(8,db.queryForObject("SELECT max(attempts) FROM meeting_reminder_deliveries",Integer.class));
    }
    @Test void titleEditsDoNotResendAndDisabledMailDoesNotConsumeAttempts() {
        UUID id=meeting(1800); when(mail.available()).thenReturn(false); dispatcher.dispatch(); sends(0); assertEquals(0,count("PENDING"));
        when(mail.available()).thenReturn(true); dispatcher.dispatch(); sends(2);
        var old=service.detail(project,id,owner);
        service.update(project,id,owner,new Command("Edited title","",old.startsAt(),old.endsAt(),old.zoneId(),List.of(),old.attendeeIds()));
        dispatcher.dispatch(); sends(2);
    }
    @Test void changedScheduleDuringSmtpDoesNotBlockUpdateAndRemainingOldJobsAreRejected() {
        UUID id=meeting(1800); var first=new java.util.concurrent.atomic.AtomicBoolean(true);
        doAnswer(i->{if(first.getAndSet(false)) move(id,86400,Set.of(owner));return null;}).when(mail).send(any());
        dispatcher.dispatch(); sends(1); assertEquals(1,count("CANCELLED"));
        dispatcher.dispatch(); sends(1); assertEquals(1,count("PENDING"));
    }
    @Test void realMailpitReceivesMultipartLocalizedMailOnceWithoutOtherRecipients() throws Exception {
        var environment=new MockEnvironment().withProperty("MAIL_ENABLED","true").withProperty("MAIL_PROVIDER","smtp")
                .withProperty("SMTP_HOST",mailpit.getHost()).withProperty("SMTP_PORT",mailpit.getMappedPort(1025).toString())
                .withProperty("SMTP_AUTH","false").withProperty("SMTP_STARTTLS","false").withProperty("SMTP_SSL","false")
                .withProperty("SMTP_FROM_ADDRESS","pda-qa@example.test").withProperty("FRONTEND_URL","http://localhost:3001");
        var actual=new SmtpMeetingReminderMail(environment);
        doAnswer(i->{actual.send(i.getArgument(0));return null;}).when(mail).send(any());
        UUID id=meeting(1800); dispatcher.dispatch(); dispatcher.dispatch();
        var http=HttpClient.newHttpClient();
        String base="http://"+mailpit.getHost()+":"+mailpit.getMappedPort(8025);
        String messages=http.send(HttpRequest.newBuilder(URI.create(base+"/api/v1/messages")).GET().build(),HttpResponse.BodyHandlers.ofString()).body();
        assertTrue(messages.contains(owner+"@example.test")); assertTrue(messages.contains(attendee+"@example.test"));
        assertFalse(messages.contains(other+"@example.test"));
        var ids=com.jayway.jsonpath.JsonPath.<List<String>>read(messages,"$.messages[*].ID"); assertEquals(2,ids.size());
        String message=http.send(HttpRequest.newBuilder(URI.create(base+"/api/v1/message/"+ids.getFirst())).GET().build(),HttpResponse.BodyHandlers.ofString()).body();
        assertTrue(message.contains("Reminder QA")); assertTrue(message.contains("Europe/Istanbul")); assertTrue(message.contains("Text")); assertTrue(message.contains("HTML"));
        assertTrue(message.contains("/tr/projeler/"+project+"/toplantilar/"+id)); assertEquals(2,count("SENT"));
    }
    private static void await(CountDownLatch latch) { try { latch.await(); } catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); } }
    @TestConfiguration static class TestTime {
        @Bean @Primary MutableClock testClock() { return new MutableClock(); }
    }
    static class MutableClock extends Clock {
        volatile java.util.function.Supplier<Instant> source=()->Instant.parse("2026-10-25T12:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return source.get(); }
    }
}
