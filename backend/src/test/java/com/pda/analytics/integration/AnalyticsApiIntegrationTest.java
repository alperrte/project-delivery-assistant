package com.pda.analytics.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** The anonymous, consent-gated analytics endpoint against the real schema (V62) in PostgreSQL. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AnalyticsApiIntegrationTest {

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
        registry.add("analytics.rate-limit.max-requests", () -> "12");
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    private static final AtomicInteger ADDRESSES = new AtomicInteger();
    private static final String SPAM_ADDRESS = "analytics-test-spam";

    private static String address() {
        return "analytics-test-" + ADDRESSES.incrementAndGet();
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private ResultActions send(String address, String json) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/analytics/events").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .with(request -> { request.setRemoteAddr(address); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static String event(String type, UUID visitor, UUID session, String path, String extra) {
        return "{\"type\":\"" + type + "\",\"visitorId\":\"" + visitor + "\",\"sessionId\":\"" + session
                + "\",\"path\":\"" + path + "\",\"consentVersion\":1" + (extra.isEmpty() ? "" : "," + extra) + "}";
    }

    private Map<String, Object> session(UUID id) {
        return jdbc.queryForMap("SELECT * FROM analytics_sessions WHERE id = ?", id);
    }

    private int pageViews(UUID session) {
        return jdbc.queryForObject("SELECT count(*) FROM analytics_page_views WHERE session_id = ?", Integer.class,
                session);
    }

    @Test
    void aConsentedPageViewCreatesTheSessionAndPageViewRowsWithoutAnyCookieOrIdentity() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        var result = send(address(), event("PAGE_VIEW", visitor, session, "/projects/[slug]/tasks",
                "\"referrerHost\":\"www.google.com\"")).andExpect(status().isNoContent()).andReturn();
        assertEquals("no-store", result.getResponse().getHeader("Cache-Control"));
        assertNull(result.getResponse().getHeader("Set-Cookie"));

        Map<String, Object> row = session(session);
        assertEquals(visitor, row.get("visitor_id"));
        assertEquals("/projects/[slug]/tasks", row.get("entry_path"));
        assertEquals("SEARCH", row.get("source_type"));
        assertEquals("google.com", row.get("referrer_domain"));
        assertEquals(1, row.get("page_views"));
        assertEquals(0, row.get("engaged_seconds"));
        assertEquals(1, pageViews(session));

        // A second page view of the same session keeps the entry page and source; only the counters move.
        send(address(), event("PAGE_VIEW", visitor, session, "/dashboard", "\"referrerHost\":\"example.org\""))
                .andExpect(status().isNoContent());
        row = session(session);
        assertEquals("/projects/[slug]/tasks", row.get("entry_path"));
        assertEquals("SEARCH", row.get("source_type"));
        assertEquals(2, row.get("page_views"));
        assertEquals(2, pageViews(session));
    }

    @Test
    void sourcesAreClassifiedOnTheServerFromReferrerAndUtm() throws Exception {
        UUID direct = UUID.randomUUID(), referral = UUID.randomUUID(), campaign = UUID.randomUUID(),
                shared = UUID.randomUUID();
        String address = address();
        send(address, event("PAGE_VIEW", UUID.randomUUID(), direct, "/", "")).andExpect(status().isNoContent());
        send(address, event("PAGE_VIEW", UUID.randomUUID(), referral, "/", "\"referrerHost\":\"News.Example.org\""))
                .andExpect(status().isNoContent());
        send(address, event("PAGE_VIEW", UUID.randomUUID(), campaign, "/login",
                "\"referrerHost\":\"mail.example.org\",\"utmSource\":\"newsletter\",\"utmMedium\":\"email\","
                        + "\"utmCampaign\":\"launch-2026\"")).andExpect(status().isNoContent());
        // A visit that merely looks shared (no referrer, no UTM) is DIRECT.
        send(address, event("PAGE_VIEW", UUID.randomUUID(), shared, "/register", "")).andExpect(status().isNoContent());

        assertEquals("DIRECT", session(direct).get("source_type"));
        assertEquals("REFERRAL", session(referral).get("source_type"));
        assertEquals("news.example.org", session(referral).get("referrer_domain"));
        Map<String, Object> row = session(campaign);
        assertEquals("CAMPAIGN", row.get("source_type"));
        assertEquals("newsletter", row.get("utm_source"));
        assertEquals("email", row.get("utm_medium"));
        assertEquals("launch-2026", row.get("utm_campaign"));
        assertEquals("DIRECT", session(shared).get("source_type"));
    }

    @Test
    void unknownEventTypesAndFakeBusinessEventsAreRejectedAndStoreNothing() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        String address = address();
        for (String type : new String[] {"ADMIN_LOGIN", "REGISTRATION", "CONTACT_SUBMITTED", "page_view", ""}) {
            send(address, event(type, visitor, session, "/login", "")).andExpect(status().isBadRequest());
        }
        send(address, "{\"visitorId\":\"" + visitor + "\",\"sessionId\":\"" + session + "\",\"path\":\"/\",\"consentVersion\":1}")
                .andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM analytics_sessions WHERE id = ?", Integer.class, session));
    }

    @Test
    void identityFieldsAreNeverBoundAndTheSchemaHasNoPersonalColumns() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        send(address(), event("PAGE_VIEW", visitor, session, "/",
                "\"userId\":\"" + UUID.randomUUID() + "\",\"role\":\"ADMIN\",\"email\":\"a@b.example\","
                        + "\"startedAt\":\"1999-01-01T00:00:00Z\",\"engagedSeconds\":500"))
                .andExpect(status().isNoContent());
        Map<String, Object> row = session(session);
        // The server clock decides; a client-sent time or active time on a PAGE_VIEW changes nothing.
        assertTrue(((java.sql.Timestamp) row.get("started_at")).toInstant().isAfter(java.time.Instant.parse("2026-01-01T00:00:00Z")));
        assertEquals(0, row.get("engaged_seconds"));

        List<String> columns = jdbc.queryForList("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name IN ('analytics_sessions', 'analytics_page_views') ORDER BY column_name
                """, String.class);
        assertEquals(List.of("consent_version", "engaged_seconds", "entry_path", "id", "id", "last_seen_at",
                "occurred_at", "page_views", "path", "referrer_domain", "session_id", "source_type", "started_at",
                "utm_campaign", "utm_medium", "utm_source", "visitor_id"), columns);
        for (String column : columns) {
            assertFalse(column.matches(".*(user|email|name|ip|agent|query|token).*"), column);
        }
    }

    @Test
    void routePathsMustBeTemplatesWithoutQueryStringsOrAbsoluteUrls() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        String address = address();
        for (String path : new String[] {"/login?token=secret", "/invite#token=abc", "https://evil.example/x",
                "//evil.example", "login", "/a b", "/" + "a".repeat(201), "/../etc", "/%2e%2e", "/a/"}) {
            send(address, event("PAGE_VIEW", visitor, session, path, "")).andExpect(status().isBadRequest());
        }
        send(address, "{\"type\":\"PAGE_VIEW\",\"visitorId\":\"not-a-uuid\",\"sessionId\":\"" + session
                + "\",\"path\":\"/\",\"consentVersion\":1}").andExpect(status().isBadRequest());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM analytics_sessions WHERE id = ?", Integer.class, session));
    }

    @Test
    void engagementIsCappedByServerSideElapsedTime() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        String address = address();
        send(address, event("PAGE_VIEW", visitor, session, "/dashboard", "")).andExpect(status().isNoContent());

        // Immediately after the page view the browser cannot have been active for 100 seconds.
        send(address, event("ENGAGEMENT", visitor, session, "/dashboard", "\"engagedSeconds\":100"))
                .andExpect(status().isNoContent());
        int immediate = (int) session(session).get("engaged_seconds");
        assertTrue(immediate <= 5, "credited " + immediate);

        // After 30 real seconds, up to 30 (+5 tolerance) are believable, never the 200 claimed.
        jdbc.update("UPDATE analytics_sessions SET last_seen_at = now() - interval '30 seconds', engaged_seconds = 0 WHERE id = ?", session);
        send(address, event("ENGAGEMENT", visitor, session, "/dashboard", "\"engagedSeconds\":200"))
                .andExpect(status().isNoContent());
        int afterWait = (int) session(session).get("engaged_seconds");
        assertTrue(afterWait >= 35 && afterWait <= 36, "credited " + afterWait);
    }

    @Test
    void engagementAboveTheRequestLimitIsRejectedAndOneWithoutSecondsIsInvalid() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        String address = address();
        send(address, event("PAGE_VIEW", visitor, session, "/dashboard", "")).andExpect(status().isNoContent());
        send(address, event("ENGAGEMENT", visitor, session, "/dashboard", "\"engagedSeconds\":601"))
                .andExpect(status().isBadRequest());
        send(address, event("ENGAGEMENT", visitor, session, "/dashboard", "\"engagedSeconds\":-1"))
                .andExpect(status().isBadRequest());
        send(address, event("ENGAGEMENT", visitor, session, "/dashboard", "")).andExpect(status().isBadRequest());
        assertEquals(0, session(session).get("engaged_seconds"));
    }

    @Test
    void engagementForAnUnknownSessionIs404AndAForeignVisitorCannotWriteToASession() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        String address = address();
        send(address, event("ENGAGEMENT", visitor, UUID.randomUUID(), "/dashboard", "\"engagedSeconds\":5"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ANALYTICS_SESSION_UNKNOWN"));
        send(address, event("PAGE_VIEW", visitor, session, "/dashboard", "")).andExpect(status().isNoContent());
        UUID intruder = UUID.randomUUID();
        send(address, event("PAGE_VIEW", intruder, session, "/dashboard", "")).andExpect(status().isBadRequest());
        send(address, event("ENGAGEMENT", intruder, session, "/dashboard", "\"engagedSeconds\":5"))
                .andExpect(status().isBadRequest());
        assertEquals(1, session(session).get("page_views"));
        assertEquals(visitor, session(session).get("visitor_id"));
    }

    @Test
    void csrfIsEnforcedOnThePublicEndpoint() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        mvc.perform(post("/api/v1/analytics/events").with(request -> { request.setRemoteAddr(address()); return request; })
                        .contentType(MediaType.APPLICATION_JSON).content(event("PAGE_VIEW", visitor, session, "/", "")))
                .andExpect(status().isForbidden());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM analytics_sessions WHERE id = ?", Integer.class, session));
    }

    @Test
    void anOversizedBodyIsRefusedBeforeItIsParsed() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        send(address(), event("PAGE_VIEW", visitor, session, "/", "\"utmCampaign\":\"" + "x".repeat(2_100) + "\""))
                .andExpect(status().is(413)).andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM analytics_sessions WHERE id = ?", Integer.class, session));
    }

    private int count(String table, UUID session) {
        return jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE session_id = ?", Integer.class, session);
    }

    private UUID knownSession(UUID visitor, String address) throws Exception {
        UUID session = UUID.randomUUID();
        send(address, event("PAGE_VIEW", visitor, session, "/", "")).andExpect(status().isNoContent());
        return session;
    }

    @Test
    void everyAllowListedCtaIdIsStoredForAKnownSessionAndNothingElse() throws Exception {
        UUID visitor = UUID.randomUUID();
        for (String cta : new String[] {"landing_register", "landing_login", "header_register", "header_login",
                "register_submit", "contact_submit", "github_repo"}) {
            String address = address();
            UUID session = knownSession(visitor, address);
            var result = send(address, event("CTA_CLICK", visitor, session, "/", "\"ctaId\":\"" + cta + "\""))
                    .andExpect(status().isNoContent()).andReturn();
            assertEquals("no-store", result.getResponse().getHeader("Cache-Control"));
            assertNull(result.getResponse().getHeader("Set-Cookie"));
            assertEquals(cta, jdbc.queryForObject("SELECT cta_id FROM analytics_cta_clicks WHERE session_id = ?",
                    String.class, session));
            // A click is not a page view and does not move the page counter.
            assertEquals(1, session(session).get("page_views"));
        }
        assertEquals(List.of("cta_id", "id", "occurred_at", "session_id"), jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'analytics_cta_clicks' ORDER BY column_name",
                String.class));
    }

    @Test
    void anUnknownMalformedOrMissingCtaIdIsRejectedAndStoresNothing() throws Exception {
        UUID visitor = UUID.randomUUID();
        String address = address();
        UUID session = knownSession(visitor, address);
        for (String extra : new String[] {"\"ctaId\":\"buy_now\"", "\"ctaId\":\"LANDING_REGISTER\"",
                "\"ctaId\":\"landing-register\"", "\"ctaId\":\"landing_register \"", "\"ctaId\":\"\"",
                "\"ctaId\":\"a@b.example\"", "\"ctaId\":\"" + "a".repeat(41) + "\"", ""}) {
            send(address, event("CTA_CLICK", visitor, session, "/", extra)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("ANALYTICS_INVALID"));
        }
        assertEquals(0, count("analytics_cta_clicks", session));
    }

    @Test
    void ctaClicksAndClientErrorsNeedAKnownSessionOfTheSameVisitorAndAConsentVersion() throws Exception {
        UUID visitor = UUID.randomUUID();
        String address = address();
        send(address, event("CTA_CLICK", visitor, UUID.randomUUID(), "/", "\"ctaId\":\"landing_login\""))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("ANALYTICS_SESSION_UNKNOWN"));
        send(address, event("CLIENT_ERROR", visitor, UUID.randomUUID(), "/", "\"errorKind\":\"render\""))
                .andExpect(status().isNotFound());
        UUID session = knownSession(visitor, address);
        UUID intruder = UUID.randomUUID();
        send(address, event("CTA_CLICK", intruder, session, "/", "\"ctaId\":\"landing_login\""))
                .andExpect(status().isBadRequest());
        send(address, event("CLIENT_ERROR", intruder, session, "/", "\"errorKind\":\"render\""))
                .andExpect(status().isBadRequest());
        // The consent version is required exactly like for page views.
        send(address, "{\"type\":\"CTA_CLICK\",\"visitorId\":\"" + visitor + "\",\"sessionId\":\"" + session
                + "\",\"path\":\"/\",\"ctaId\":\"landing_login\"}").andExpect(status().isBadRequest());
        assertEquals(0, count("analytics_cta_clicks", session));
        assertEquals(0, count("analytics_client_errors", session));
    }

    @Test
    void aClientErrorStoresTheRouteAndTheKindOnlyEvenWhenMessagesAndStacksAreSent() throws Exception {
        UUID visitor = UUID.randomUUID();
        String address = address();
        UUID session = knownSession(visitor, address);
        send(address, event("CLIENT_ERROR", visitor, session, "/projects/[slug]/tasks",
                "\"errorKind\":\"chunk_load\",\"message\":\"ChunkLoadError at https://app.example/x?token=abc\","
                        + "\"stack\":\"at foo (bar.js:1)\",\"url\":\"https://app.example/p/42\",\"userId\":\"" + UUID.randomUUID()
                        + "\",\"userAgent\":\"Mozilla\",\"email\":\"a@b.example\""))
                .andExpect(status().isNoContent());
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM analytics_client_errors WHERE session_id = ?", session);
        assertEquals("/projects/[slug]/tasks", row.get("path"));
        assertEquals("CHUNK_LOAD", row.get("error_kind"));
        assertEquals(List.of("error_kind", "id", "occurred_at", "path", "session_id"), jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'analytics_client_errors' ORDER BY column_name",
                String.class));
        // No stored value carries any of the rejected material.
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM analytics_client_errors WHERE path || error_kind"
                + " ~* '(token|abc|stack|mozilla|@|http)'", Integer.class));
        for (String kind : new String[] {"render", "chunk_load", "unhandled_rejection", "network"}) {
            send(address, event("CLIENT_ERROR", visitor, session, "/dashboard", "\"errorKind\":\"" + kind + "\""))
                    .andExpect(status().isNoContent());
        }
        assertEquals(5, count("analytics_client_errors", session));
    }

    @Test
    void anUnknownMalformedOrMissingErrorKindIsRejectedAndStoresNothing() throws Exception {
        UUID visitor = UUID.randomUUID();
        String address = address();
        UUID session = knownSession(visitor, address);
        for (String extra : new String[] {"\"errorKind\":\"oops\"", "\"errorKind\":\"RENDER\"",
                "\"errorKind\":\"TypeError: x is undefined\"", "\"errorKind\":\"\"", ""}) {
            send(address, event("CLIENT_ERROR", visitor, session, "/", extra)).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("ANALYTICS_INVALID"));
        }
        // The route must be a template like for page views.
        send(address, event("CLIENT_ERROR", visitor, session, "/p/42?x=1", "\"errorKind\":\"render\""))
                .andExpect(status().isBadRequest());
        assertEquals(0, count("analytics_client_errors", session));
    }

    @Test
    void clicksAndErrorsAreBoundedPerSessionAndFurtherOnesAreDroppedQuietly() throws Exception {
        UUID visitor = UUID.randomUUID();
        String address = address();
        UUID session = knownSession(visitor, address);
        jdbc.update("INSERT INTO analytics_cta_clicks (id, session_id, cta_id, occurred_at) "
                + "SELECT gen_random_uuid(), ?, 'landing_login', now() FROM generate_series(1, 99)", session);
        jdbc.update("INSERT INTO analytics_client_errors (id, session_id, path, error_kind, occurred_at) "
                + "SELECT gen_random_uuid(), ?, '/', 'NETWORK', now() FROM generate_series(1, 49)", session);
        for (int i = 0; i < 2; i++) {
            send(address, event("CTA_CLICK", visitor, session, "/", "\"ctaId\":\"landing_login\"")).andExpect(status().isNoContent());
            send(address, event("CLIENT_ERROR", visitor, session, "/", "\"errorKind\":\"network\"")).andExpect(status().isNoContent());
        }
        assertEquals(100, count("analytics_cta_clicks", session));
        assertEquals(50, count("analytics_client_errors", session));
    }

    @Test
    void theEndpointIsRateLimitedPerAddress() throws Exception {
        UUID visitor = UUID.randomUUID(), session = UUID.randomUUID();
        for (int i = 0; i < 12; i++) {
            send(SPAM_ADDRESS, event("PAGE_VIEW", visitor, session, "/", "")).andExpect(status().isNoContent());
        }
        send(SPAM_ADDRESS, event("PAGE_VIEW", visitor, session, "/", "")).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        // Another address is unaffected.
        send(address(), event("PAGE_VIEW", UUID.randomUUID(), UUID.randomUUID(), "/", "")).andExpect(status().isNoContent());
    }
}
