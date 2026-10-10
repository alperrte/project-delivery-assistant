package com.pda.admin.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.BackendApplication;
import com.pda.analytics.application.service.AnalyticsRetentionJob;
import com.pda.audit.application.service.AuditRetentionJob;
import com.pda.contact.application.service.ContactRetentionJob;
import com.pda.shared.BatchPurge;
import com.pda.shared.ScheduledJobRegistry;
import com.pda.user.application.service.UserSessionRetentionJob;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * The daily retention purges against the real schema: each family is cut at exactly its published period (a row exactly
 * at the cut-off stays), dependants go with their parent, batches work, a second run finds nothing, and the status
 * registry learns of every run. The jobs are driven with a fixed "now"; the cron itself is configuration.
 */
@SpringBootTest(classes = BackendApplication.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RetentionJobsIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        // The real cron must not fire during the test; the jobs are called directly.
        registry.add("RETENTION_CRON", () -> "-");
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired BCryptPasswordEncoder encoder;
    @Autowired BatchPurge purge;
    @Autowired ScheduledJobRegistry registry;
    @Autowired AnalyticsRetentionJob analyticsJob;
    @Autowired ContactRetentionJob contactJob;
    @Autowired UserSessionRetentionJob sessionJob;
    @Autowired AuditRetentionJob auditJob;

    private static final Instant NOW = Instant.parse("2027-03-10T12:00:00Z");

    private long count(String table) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class);
    }

    private ScheduledJobRegistry.JobRun lastRun(String name) {
        return registry.snapshot().stream().filter(run -> run.name().equals(name)).findFirst().orElseThrow();
    }

    // ---- analytics: 12 months -------------------------------------------------------------------------

    private UUID analyticsSession(String lastSeenAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO analytics_sessions (id, visitor_id, started_at, last_seen_at, engaged_seconds, page_views,
                    entry_path, source_type, consent_version)
                VALUES (?, ?, ?::timestamptz, ?::timestamptz, 0, 1, '/', 'DIRECT', 1)
                """, id, UUID.randomUUID(), lastSeenAt, lastSeenAt);
        jdbc.update("INSERT INTO analytics_page_views (id, session_id, path, occurred_at) VALUES (?, ?, '/', ?::timestamptz)",
                UUID.randomUUID(), id, lastSeenAt);
        jdbc.update("INSERT INTO analytics_cta_clicks (id, session_id, cta_id, occurred_at) VALUES (?, ?, 'landing_login', ?::timestamptz)",
                UUID.randomUUID(), id, lastSeenAt);
        jdbc.update("INSERT INTO analytics_client_errors (id, session_id, path, error_kind, occurred_at)"
                + " VALUES (?, ?, '/', 'NETWORK', ?::timestamptz)", UUID.randomUUID(), id, lastSeenAt);
        return id;
    }

    @Test
    void analyticsOlderThanTwelveMonthsGoesWithItsPageViewsClicksAndErrorsAndTheCutoffRowStays() {
        jdbc.update("DELETE FROM analytics_sessions");
        // NOW is 2027-03-10T12:00Z, so the cut-off is 2026-03-10T12:00Z.
        UUID old = analyticsSession("2026-03-10T11:59:59Z");
        UUID boundary = analyticsSession("2026-03-10T12:00:00Z");
        UUID fresh = analyticsSession("2026-03-10T12:00:01Z");
        UUID veryOld = analyticsSession("2024-01-01T00:00:00Z");

        assertEquals(2, analyticsJob.run(NOW));

        assertEquals(List.of(boundary, fresh).stream().map(UUID::toString).sorted().toList(),
                jdbc.queryForList("SELECT id::text FROM analytics_sessions ORDER BY id::text", String.class));
        for (String table : new String[] {"analytics_page_views", "analytics_cta_clicks", "analytics_client_errors"}) {
            assertEquals(2, count(table), table);
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE session_id IN (?, ?)",
                    Integer.class, old, veryOld), table);
        }
        // Idempotent: nothing left to remove.
        assertEquals(0, analyticsJob.run(NOW));
        assertEquals(2, count("analytics_sessions"));
        assertEquals(ScheduledJobRegistry.Outcome.SUCCESS, lastRun("retention.analytics").outcome());
    }

    @Test
    void theCutoffIsCalendarMonthsInUtcEvenAcrossALeapDay() {
        jdbc.update("DELETE FROM analytics_sessions");
        // 12 months before 2028-02-29T10:00Z is 2027-02-28T10:00Z.
        analyticsSession("2027-02-28T09:59:59Z");
        UUID kept = analyticsSession("2027-02-28T10:00:00Z");
        assertEquals(1, analyticsJob.run(Instant.parse("2028-02-29T10:00:00Z")));
        assertEquals(List.of(kept.toString()), jdbc.queryForList("SELECT id::text FROM analytics_sessions", String.class));
    }

    @Test
    void aBatchSizeSmallerThanTheBacklogStillClearsEverything() {
        jdbc.update("DELETE FROM analytics_sessions");
        for (int i = 0; i < 7; i++) {
            analyticsSession("2025-01-0" + (i + 1) + "T00:00:00Z");
        }
        UUID kept = analyticsSession("2027-03-01T00:00:00Z");
        AnalyticsRetentionJob small = new AnalyticsRetentionJob(purge, registry, Clock.fixed(NOW, ZoneOffset.UTC), 12, 2);
        assertEquals(7, small.run(NOW));
        assertEquals(List.of(kept.toString()), jdbc.queryForList("SELECT id::text FROM analytics_sessions", String.class));
        assertEquals(7, lastRun("retention.analytics").affected());
    }

    // ---- ended sessions: 30 days -----------------------------------------------------------------------

    private UUID user() {
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), "Member-Password-1", encoder));
        return user.getId();
    }

    private void session(UUID user, String expiresAt, String revokedAt) {
        jdbc.update("""
                INSERT INTO user_sessions (id, user_id, refresh_token_hash, created_at, expires_at, revoked_at)
                VALUES (?, ?, ?, '2026-01-01T00:00:00Z', ?::timestamptz, ?::timestamptz)
                """, UUID.randomUUID(), user,
                (UUID.randomUUID() + "" + UUID.randomUUID()).replace("-", "").substring(0, 64), expiresAt, revokedAt);
    }

    @Test
    void sessionsRevokedOrExpiredMoreThanThirtyDaysAgoAreRemovedAndActiveOnesNever() {
        jdbc.update("DELETE FROM user_sessions");
        UUID owner = user();
        // NOW is 2027-03-10T12:00Z, so the cut-off is 2027-02-08T12:00Z.
        session(owner, "2027-02-08T11:59:59Z", null);       // expired just before the cut-off: removed
        session(owner, "2027-02-08T12:00:00Z", null);       // expired exactly at it: stays
        session(owner, "2027-02-20T00:00:00Z", null);       // expired recently: stays
        session(owner, "2027-06-01T00:00:00Z", "2027-02-08T11:59:59Z"); // revoked before the cut-off, would expire later: removed
        session(owner, "2027-06-01T00:00:00Z", "2027-02-08T12:00:00Z"); // revoked exactly at it: stays
        session(owner, "2027-06-01T00:00:00Z", "2027-03-01T00:00:00Z"); // revoked recently: stays
        session(owner, "2027-06-01T00:00:00Z", null);       // active: stays
        session(owner, "2020-01-01T00:00:00Z", "2020-01-02T00:00:00Z"); // long ended: removed

        assertEquals(3, sessionJob.run(NOW));
        assertEquals(5, count("user_sessions"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE revoked_at IS NULL AND expires_at > ?::timestamptz",
                Integer.class, "2027-03-10T12:00:00Z"));
        assertEquals(0, sessionJob.run(NOW));
        assertEquals(ScheduledJobRegistry.Outcome.SUCCESS, lastRun("retention.user-sessions").outcome());
    }

    // ---- contact records and support messages: 12 months -------------------------------------------------

    @Test
    void contactRecordsAndSupportMessagesOlderThanTwelveMonthsAreRemoved() {
        jdbc.update("DELETE FROM contact_requests");
        jdbc.update("DELETE FROM support_requests");
        for (String at : new String[] {"2026-03-10T11:59:59Z", "2026-03-10T12:00:00Z", "2026-03-10T12:00:01Z"}) {
            jdbc.update("INSERT INTO contact_requests (id, created_at, delivery_status) VALUES (?, ?::timestamptz, 'SENT')",
                    UUID.randomUUID(), at);
            jdbc.update("""
                    INSERT INTO support_requests (id, created_at, category, first_name, email, message, status,
                                                  status_changed_at, delivery_status)
                    VALUES (?, ?::timestamptz, 'GENERAL', 'Ece', 'old@visitor.test', 'Eski bir destek mesajı.', 'CLOSED',
                            ?::timestamptz, 'SENT')
                    """, UUID.randomUUID(), at, at);
        }
        assertEquals(2, contactJob.run(NOW));
        assertEquals(2, count("contact_requests"));
        assertEquals(2, count("support_requests"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM support_requests WHERE created_at < ?::timestamptz",
                Integer.class, "2026-03-10T12:00:00Z"));
        assertEquals(0, contactJob.run(NOW));
        assertEquals(0, lastRun("retention.contact").affected(), "the last run removed nothing");
    }

    // ---- audit events: 24 months ------------------------------------------------------------------------

    @Test
    void auditEventsOlderThanTwentyFourMonthsAreRemoved() {
        jdbc.update("DELETE FROM admin_audit_events");
        // 24 months before 2027-03-10T12:00Z is 2025-03-10T12:00Z.
        for (String at : new String[] {"2025-03-10T11:59:59Z", "2025-03-10T12:00:00Z", "2026-12-01T00:00:00Z", "2020-01-01T00:00:00Z"}) {
            jdbc.update("INSERT INTO admin_audit_events (id, occurred_at, actor_user_id, action, target_type, target_id, outcome)"
                    + " VALUES (?, ?::timestamptz, NULL, 'ADMIN_SIGN_IN', 'SYSTEM', NULL, 'FAILURE')", UUID.randomUUID(), at);
        }
        assertEquals(2, auditJob.run(NOW));
        assertEquals(List.of("2025-03-10T12:00:00Z", "2026-12-01T00:00:00Z"), jdbc.queryForList(
                "SELECT to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') FROM admin_audit_events ORDER BY occurred_at",
                String.class));
        assertEquals(0, auditJob.run(NOW));
    }

    // ---- configuration -----------------------------------------------------------------------------------

    @Test
    void everyRetentionJobIsListedInTheStatusRegistryFromStartUp() {
        List<String> names = registry.snapshot().stream().map(ScheduledJobRegistry.JobRun::name).toList();
        assertTrue(names.containsAll(List.of("retention.analytics", "retention.contact", "retention.user-sessions",
                "retention.audit")), names.toString());
    }

    @Test
    void theDefaultsAreThePublishedRetentionPeriodsAndTheYearAndTheMonthMathIsCalendarBased() {
        assertEquals(Instant.parse("2026-03-10T12:00:00Z"), BatchPurge.monthsBefore(NOW, 12));
        assertEquals(Instant.parse("2025-03-10T12:00:00Z"), BatchPurge.monthsBefore(NOW, 24));
        assertEquals(Instant.parse("2027-02-08T12:00:00Z"), BatchPurge.daysBefore(NOW, 30));
    }
}
