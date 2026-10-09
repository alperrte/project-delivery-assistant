package com.pda.admin.integration;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** The administration dashboard: ranges, zones, seeded rows from the three sources, and who may read it. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminAnalyticsIntegrationTest {

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
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;

    private static final AtomicInteger IPS = new AtomicInteger();

    private User newUser(String role) {
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), "Member-Password-1", encoder));
        if (!"USER".equals(role)) {
            jdbc.update("UPDATE users SET global_role = ? WHERE id = ?", role, user.getId());
        }
        return users.findById(user.getId()).orElseThrow();
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private Cookie access(User user) throws Exception {
        Cookie csrf = csrf();
        String address = "dash-test-" + IPS.incrementAndGet();
        var headers = mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .with(request -> { request.setRemoteAddr(address); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"Member-Password-1\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String value = headers.stream().filter(h -> h.startsWith("PDA_ACCESS=")).findFirst().orElseThrow()
                .split(";", 2)[0].substring("PDA_ACCESS=".length());
        return new Cookie("PDA_ACCESS", value);
    }

    private void session(UUID id, String startedAt, String source, String referrer, String campaign, int engaged,
                         String... viewTimes) {
        jdbc.update("""
                INSERT INTO analytics_sessions (id, visitor_id, started_at, last_seen_at, engaged_seconds, page_views,
                    entry_path, source_type, referrer_domain, utm_campaign, consent_version)
                VALUES (?, ?, ?::timestamptz, ?::timestamptz, ?, ?, '/login', ?, ?, ?, 1)
                """, id, UUID.randomUUID(), startedAt, startedAt, engaged, viewTimes.length, source, referrer, campaign);
        for (String at : viewTimes) {
            jdbc.update("INSERT INTO analytics_page_views (id, session_id, path, occurred_at) VALUES (?, ?, '/login', ?::timestamptz)",
                    UUID.randomUUID(), id, at);
        }
    }

    @Test
    void theDashboardComposesTrafficRegistrationsAccountsAndContactRequestsForARangeAndZone() throws Exception {
        User admin = newUser("ADMIN");
        // Traffic. 21:30 UTC on the 10th is 00:30 on the 11th in Istanbul.
        session(UUID.randomUUID(), "2026-03-10T21:30:00Z", "SEARCH", "google.com", null, 60,
                "2026-03-10T21:30:00Z", "2026-03-10T21:35:00Z");
        session(UUID.randomUUID(), "2026-03-12T09:00:00Z", "CAMPAIGN", null, "launch", 120, "2026-03-12T09:00:00Z");
        session(UUID.randomUUID(), "2026-03-12T10:00:00Z", "DIRECT", null, null, 0, "2026-03-12T10:00:00Z");
        session(UUID.randomUUID(), "2026-03-01T10:00:00Z", "REFERRAL", "example.org", null, 999, "2026-03-01T10:00:00Z");
        // Contact messages: two delivered inside the range, one failed (never counted), one before it.
        for (String at : new String[] {"2026-03-10T22:00:00Z", "2026-03-12T08:00:00Z"}) {
            jdbc.update("INSERT INTO contact_requests (id, created_at, delivery_status) VALUES (?, ?::timestamptz, 'SENT')", UUID.randomUUID(), at);
        }
        jdbc.update("INSERT INTO contact_requests (id, created_at, delivery_status) VALUES (?, '2026-03-11T08:00:00Z', 'FAILED')", UUID.randomUUID());
        jdbc.update("INSERT INTO contact_requests (id, created_at, delivery_status) VALUES (?, '2026-02-01T08:00:00Z', 'SENT')", UUID.randomUUID());
        // Accounts: two registered on the 10th (UTC 22:00 = 11th in Istanbul) and 12th.
        User early = newUser("USER");
        User late = newUser("USER");
        User disabled = newUser("USER");
        jdbc.update("UPDATE users SET created_at = '2026-03-10T22:00:00Z' WHERE id = ?", early.getId());
        jdbc.update("UPDATE users SET created_at = '2026-03-12T07:00:00Z' WHERE id = ?", late.getId());
        jdbc.update("UPDATE users SET created_at = '2026-02-01T07:00:00Z', account_status = 'DISABLED' WHERE id = ?", disabled.getId());
        jdbc.update("UPDATE users SET created_at = '2026-01-01T07:00:00Z' WHERE id = ?", admin.getId());

        String json = mvc.perform(get("/api/v1/admin/analytics?from=2026-03-10&to=2026-03-13&zone=Europe/Istanbul")
                        .cookie(access(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.range.days").value(4))
                .andExpect(jsonPath("$.range.zone").value("Europe/Istanbul"))
                // Traffic: 4 page views and 3 sessions started in range; the 1st of March is outside.
                .andExpect(jsonPath("$.traffic.visits").value(4))
                .andExpect(jsonPath("$.traffic.uniqueSessions").value(3))
                .andExpect(jsonPath("$.traffic.uniqueVisitors").value(3))
                .andExpect(jsonPath("$.traffic.averageEngagedSeconds").value(60))
                .andExpect(jsonPath("$.traffic.daily.length()").value(4))
                // The day is cut in Istanbul: both views of the first session are on the 11th.
                .andExpect(jsonPath("$.traffic.daily[0].date").value("2026-03-10"))
                .andExpect(jsonPath("$.traffic.daily[0].visits").value(0))
                .andExpect(jsonPath("$.traffic.daily[1].date").value("2026-03-11"))
                .andExpect(jsonPath("$.traffic.daily[1].visits").value(2))
                .andExpect(jsonPath("$.traffic.daily[1].sessions").value(1))
                .andExpect(jsonPath("$.traffic.daily[2].visits").value(2))
                .andExpect(jsonPath("$.traffic.daily[3].visits").value(0))
                .andExpect(jsonPath("$.traffic.sources.length()").value(3))
                .andExpect(jsonPath("$.traffic.topReferrers[0].name").value("google.com"))
                .andExpect(jsonPath("$.traffic.topCampaigns[0].campaign").value("launch"))
                // Registrations come from the user table, by day in the requested zone.
                .andExpect(jsonPath("$.registrations.inRange").value(2))
                .andExpect(jsonPath("$.registrations.daily[1].date").value("2026-03-11"))
                .andExpect(jsonPath("$.registrations.daily[1].value").value(1))
                .andExpect(jsonPath("$.registrations.daily[2].value").value(1))
                // Accounts are overall counts; "terminated" is DISABLED.
                .andExpect(jsonPath("$.accounts.terminated").value(1))
                .andExpect(jsonPath("$.accounts.admins").isNumber())
                // Contact: only delivered messages, none of the failed one.
                .andExpect(jsonPath("$.contactRequests.inRange").value(2))
                .andExpect(jsonPath("$.contactRequests.total").value(3))
                .andExpect(jsonPath("$.contactRequests.daily[1].value").value(1))
                .andExpect(jsonPath("$.contactRequests.daily[2].value").value(1))
                .andReturn().getResponse().getContentAsString();

        // Aggregates only: no address, name, message or session identity anywhere in the answer.
        for (String forbidden : new String[] {"@example.test", "email", "nickname", "message", "visitorId", "sessionId"}) {
            assertFalse(json.contains(forbidden), forbidden);
        }

        // The same data in UTC falls on different days.
        mvc.perform(get("/api/v1/admin/analytics?from=2026-03-10&to=2026-03-13&zone=UTC").cookie(access(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.traffic.daily[0].visits").value(2))
                .andExpect(jsonPath("$.traffic.daily[1].visits").value(0))
                .andExpect(jsonPath("$.registrations.daily[0].value").value(1));
    }

    @Test
    void operationalNumbersExistWithoutAnyAnalyticsData() throws Exception {
        User admin = newUser("ADMIN");
        Cookie token = access(admin);
        jdbc.update("DELETE FROM analytics_page_views");
        jdbc.update("DELETE FROM analytics_sessions");
        mvc.perform(get("/api/v1/admin/analytics?from=2000-01-01&to=2000-01-02").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.traffic.visits").value(0))
                .andExpect(jsonPath("$.traffic.averageEngagedSeconds").value(0))
                .andExpect(jsonPath("$.traffic.daily.length()").value(2));
        // Accounts and registrations of today are counted although no analytics row exists.
        mvc.perform(get("/api/v1/admin/analytics?zone=UTC").cookie(token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.range.days").value(30))
                .andExpect(jsonPath("$.traffic.visits").value(0))
                .andExpect(jsonPath("$.accounts.total").isNumber())
                .andExpect(jsonPath("$.registrations.inRange").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
    }

    @Test
    void invalidRangesZonesAndDatesAreRejected() throws Exception {
        Cookie token = access(newUser("ADMIN"));
        for (String query : new String[] {"from=2026-03-13&to=2026-03-10", "from=2025-01-01&to=2026-03-10",
                "from=2026-03-10&to=2026-03-12&zone=Mars/Phobos", "zone=%2B03:00", "zone=" + "A".repeat(80),
                "from=not-a-date", "to=2026-13-45", "zone=SystemV/AST4"}) {
            mvc.perform(get("/api/v1/admin/analytics?" + query).cookie(token)).andExpect(status().isBadRequest());
        }
        // 366 days is the limit and is accepted.
        mvc.perform(get("/api/v1/admin/analytics?from=2025-03-12&to=2026-03-12").cookie(token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.range.days").value(366));
    }

    @Test
    void onlyAdministratorsMayReadIt() throws Exception {
        mvc.perform(get("/api/v1/admin/analytics")).andExpect(status().isUnauthorized());
        Cookie member = access(newUser("USER"));
        mvc.perform(get("/api/v1/admin/analytics").cookie(member)).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/analytics?from=2026-03-10&to=2026-03-12&zone=UTC").cookie(member))
                .andExpect(status().isForbidden());
    }
}
