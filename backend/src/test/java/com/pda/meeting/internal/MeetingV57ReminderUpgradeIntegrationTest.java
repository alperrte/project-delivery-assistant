package com.pda.meeting.internal;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.meeting.MeetingMediaPort;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.sql.DriverManager;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * The real upgrade path end to end: a PostgreSQL database that is at V56 with a project-owned, scheduled meeting is started by the
 * application (Flyway applies V57 at start-up), and the real reminder worker then sends real SMTP mail to a real Mailpit. Former active
 * project members now attend and are reminded once; a member removed earlier and a stranger of the same project are not.
 */
@SpringBootTest(classes = BackendApplication.class, properties = {"pda.meeting.enabled=true"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class MeetingV57ReminderUpgradeIntegrationTest {
    static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
    static final GenericContainer<?> mailpit = new GenericContainer<>(DockerImageName.parse("axllent/mailpit:v1.31.4")).withExposedPorts(1025, 8025);
    static final byte[] KEY = new byte[32];
    static final UUID PROJECT = UUID.randomUUID(), MEETING = UUID.randomUUID(), OWNER = UUID.randomUUID(), MEMBER_A = UUID.randomUUID(),
        MEMBER_B = UUID.randomUUID(), REMOVED = UUID.randomUUID(), STRANGER = UUID.randomUUID();
    static String email(UUID user) { return "u-" + user + "@example.test"; }
    static {
        new SecureRandom().nextBytes(KEY);
        postgres.start(); mailpit.start();
        // Database state before this release: V56, one scheduled meeting that belongs to a project, nobody listed as an attendee.
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).locations("classpath:db/migration").target("56").load().migrate();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()); var sql = connection.createStatement()) {
            for (UUID user : List.of(OWNER, MEMBER_A, MEMBER_B, REMOVED, STRANGER))
                sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('" + user + "','" + email(user) + "','n" + user.toString().substring(0, 12) + "','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('" + PROJECT + "','Legacy upgrade','legacy-upgrade','ACTIVE','MEDIUM','PRIVATE','" + OWNER + "',now(),now())");
            sql.execute("INSERT INTO project_memberships(id,project_id,user_id,joined_at,status) VALUES (gen_random_uuid(),'" + PROJECT + "','" + OWNER + "',now(),'ACTIVE'),(gen_random_uuid(),'" + PROJECT + "','" + MEMBER_A + "',now(),'ACTIVE'),"
                + "(gen_random_uuid(),'" + PROJECT + "','" + MEMBER_B + "',now(),'ACTIVE'),(gen_random_uuid(),'" + PROJECT + "','" + REMOVED + "',now(),'REMOVED')");
            sql.execute("INSERT INTO meetings(id,project_id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('" + MEETING + "','" + PROJECT + "','" + OWNER
                + "','Legacy planning',now()+interval '30 minutes',now()+interval '90 minutes','Europe/Istanbul','SCHEDULED','legacy-room',now(),now())");
        } catch (java.sql.SQLException failure) { throw new IllegalStateException(failure); }
    }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl); r.add("spring.datasource.username", postgres::getUsername); r.add("spring.datasource.password", postgres::getPassword);
        r.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(KEY)); r.add("FRONTEND_URL", () -> "http://localhost:3000");
        r.add("MAIL_ENABLED", () -> "true"); r.add("MAIL_PROVIDER", () -> "smtp"); r.add("SMTP_HOST", mailpit::getHost); r.add("SMTP_PORT", () -> mailpit.getMappedPort(1025).toString());
        r.add("SMTP_AUTH", () -> "false"); r.add("SMTP_STARTTLS", () -> "false"); r.add("SMTP_SSL", () -> "false"); r.add("SMTP_FROM_ADDRESS", () -> "pda-qa@example.test");
    }
    @MockitoBean MeetingMediaPort media;
    @MockitoBean MeetingScheduler lifecycleScheduler;
    @MockitoBean MeetingReminderScheduler reminderScheduler;
    @Autowired MeetingReminderStore store;
    @Autowired MeetingReminderDispatcher dispatcher;
    @Autowired JdbcTemplate db;

    @Test void upgradedMeetingRemindsFormerActiveMembersOnceAndNobodyElseThroughRealSmtp() throws Exception {
        // V57 ran when the application started: the former project members attend, the organizer is not duplicated.
        assertEquals(Set.of(MEMBER_A, MEMBER_B), new HashSet<>(db.queryForList("SELECT user_id FROM meeting_attendees WHERE meeting_id=?", UUID.class, MEETING)));
        store.reconcile(); dispatcher.dispatch(); dispatcher.dispatch(); // a second pass must not send anything again
        var http = HttpClient.newHttpClient(); String base = "http://" + mailpit.getHost() + ":" + mailpit.getMappedPort(8025);
        String messages = http.send(HttpRequest.newBuilder(URI.create(base + "/api/v1/messages")).GET().build(), HttpResponse.BodyHandlers.ofString()).body();
        List<String> recipients = JsonPath.read(messages, "$.messages[*].To[*].Address");
        assertEquals(new TreeSet<>(List.of(email(OWNER), email(MEMBER_A), email(MEMBER_B))), new TreeSet<>(recipients), "organizer and the former active members");
        assertEquals(3, recipients.size(), "exactly one mail each");
        assertFalse(recipients.contains(email(REMOVED)), "a member removed before the upgrade is not reminded");
        assertFalse(recipients.contains(email(STRANGER)), "a project mate who never attended is not reminded");
        List<String> ids = JsonPath.read(messages, "$.messages[*].ID");
        String body = http.send(HttpRequest.newBuilder(URI.create(base + "/api/v1/message/" + ids.getFirst())).GET().build(), HttpResponse.BodyHandlers.ofString()).body();
        assertTrue(body.contains("/tr/toplantilar/" + MEETING), "the link is the global meeting address"); assertFalse(body.contains("projeler"));
        assertEquals(3, db.queryForObject("SELECT count(*) FROM meeting_reminder_deliveries WHERE meeting_id=? AND status='SENT'", Integer.class, MEETING));
        assertEquals(0, db.queryForObject("SELECT count(*) FROM meeting_reminder_deliveries WHERE meeting_id=? AND status<>'SENT'", Integer.class, MEETING));
        // The meeting itself survived with its owner and its (now unused) project link.
        assertEquals(OWNER, db.queryForObject("SELECT organizer_id FROM meetings WHERE id=?", UUID.class, MEETING));
        // The application also applied V58: this old meeting stays INDEPENDENT (no live project link, so no project name in any mail), its old project is archived.
        assertEquals(58, db.queryForObject("SELECT max(version::int) FROM flyway_schema_history WHERE success", Integer.class));
        assertNull(db.queryForObject("SELECT project_id FROM meetings WHERE id=?", UUID.class, MEETING));
        assertEquals(PROJECT, db.queryForObject("SELECT legacy_project_id FROM meetings WHERE id=?", UUID.class, MEETING));
        assertFalse(body.contains("Legacy upgrade"), "the old project's name is not in the mail");
    }
}
