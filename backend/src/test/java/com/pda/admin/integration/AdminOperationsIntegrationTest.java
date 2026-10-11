package com.pda.admin.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pda.BackendApplication;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * The administrator endpoints added for the support inbox, the audit trail, the system status and the analytics
 * behaviour reports: who may call them (anonymous / ordinary user / administrator without the verified sign-in /
 * verified administrator), what they return, and what each administrator action leaves in the audit trail.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminOperationsIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    private static final byte[] TOTP_KEY = new byte[32];
    static {
        new SecureRandom().nextBytes(JWT_KEY);
        new SecureRandom().nextBytes(TOTP_KEY);
    }
    private static final ObjectMapper JSON = new ObjectMapper();

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        // This suite checks the mail-disabled status; developer mail settings must not change it.
        registry.add("MAIL_ENABLED", () -> "false");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("TOTP_ENCRYPTION_KEY", () -> Base64.getEncoder().encodeToString(TOTP_KEY));
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;
    @Autowired com.pda.user.UserSessions sessions;
    @Autowired com.pda.auth.application.service.JwtTokens tokens;

    // ---- helpers ------------------------------------------------------------------------------------------

    private User newUser(String role) {
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), "Member-Password-1", encoder));
        if (!"USER".equals(role)) {
            jdbc.update("UPDATE users SET global_role = ? WHERE id = ?", role, user.getId());
        }
        return users.findById(user.getId()).orElseThrow();
    }

    private Cookie adminAccess(User admin) {
        return AdminSessionFactory.verified(sessions, tokens, admin.getId())[0];
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private ResultActions getAs(Cookie access, String path) throws Exception {
        MockHttpServletRequestBuilder request = get(path);
        return mvc.perform(access == null ? request : request.cookie(access));
    }

    private ResultActions postAs(Cookie access, String path, String body) throws Exception {
        Cookie csrf = csrf();
        MockHttpServletRequestBuilder request = post(path).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body == null ? "" : body);
        request = access == null ? request.cookie(csrf) : request.cookie(csrf, access);
        return mvc.perform(request);
    }

    private UUID support(String category, String status, String createdAt, String delivery) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO support_requests (id, created_at, category, first_name, last_name, email, message, status,
                                              status_changed_at, delivery_status)
                VALUES (?, ?::timestamptz, ?, 'Ece', ?, ?, ?, ?, ?::timestamptz, ?)
                """, id, createdAt, category, "GENERAL".equals(category) ? null : "Yıldız", id + "@visitor.test",
                "Merhaba, bu bir destek mesajıdır: " + id, status, createdAt, delivery);
        return id;
    }

    private List<Map<String, Object>> audit(String action) {
        return jdbc.queryForList("SELECT * FROM admin_audit_events WHERE action = ? ORDER BY occurred_at, id", action);
    }

    // ---- the access matrix --------------------------------------------------------------------------------

    @Test
    void theNewAdminEndpointsAnswerAnonymousUserAndUnverifiedAdministratorCallersWithoutData() throws Exception {
        User admin = newUser("ADMIN");
        User member = newUser("USER");
        UUID request = support("BUG", "NEW", "2026-03-10T10:00:00Z", "SENT");
        Cookie verified = adminAccess(admin);
        Cookie plainUser = AdminSessionFactory.unmarked(sessions, tokens, member.getId())[0];
        Cookie unverifiedAdmin = AdminSessionFactory.unmarked(sessions, tokens, admin.getId())[0];

        List<String> reads = List.of("/api/v1/admin/support-requests", "/api/v1/admin/support-requests/" + request,
                "/api/v1/admin/audit-events", "/api/v1/admin/system/status", "/api/v1/admin/analytics",
                "/api/v1/admin/users/" + member.getId());
        for (String path : reads) {
            getAs(null, path).andExpect(status().isUnauthorized());
            getAs(plainUser, path).andExpect(status().isForbidden());
            String refused = getAs(unverifiedAdmin, path).andExpect(status().isForbidden()).andReturn().getResponse()
                    .getContentAsString();
            assertFalse(refused.contains("@visitor.test"), path);
            getAs(verified, path).andExpect(status().isOk());
        }

        String change = "{\"status\":\"CLOSED\"}";
        String path = "/api/v1/admin/support-requests/" + request + "/status";
        postAs(null, path, change).andExpect(status().isUnauthorized());
        postAs(plainUser, path, change).andExpect(status().isForbidden());
        postAs(unverifiedAdmin, path, change).andExpect(status().isForbidden());
        assertEquals("NEW", jdbc.queryForObject("SELECT status FROM support_requests WHERE id = ?", String.class, request));
        // Without the CSRF header even a verified administrator is refused.
        mvc.perform(post(path).cookie(verified).contentType(MediaType.APPLICATION_JSON).content(change))
                .andExpect(status().isForbidden());
        assertEquals("NEW", jdbc.queryForObject("SELECT status FROM support_requests WHERE id = ?", String.class, request));
        postAs(verified, path, change).andExpect(status().isOk());
    }

    // ---- support requests ----------------------------------------------------------------------------------

    @Test
    void theSupportListIsNewestFirstPagedAndFilteredAndTheDetailHoldsExactlyTheStoredFields() throws Exception {
        jdbc.update("DELETE FROM support_requests");
        User admin = newUser("ADMIN");
        Cookie access = adminAccess(admin);
        UUID oldest = support("GENERAL", "NEW", "2026-03-01T10:00:00Z", "SENT");
        UUID bug = support("BUG", "IN_PROGRESS", "2026-03-02T10:00:00Z", "SENT");
        UUID data = support("DATA_REQUEST", "NEW", "2026-03-03T10:00:00Z", "FAILED");
        UUID closed = support("ACCESSIBILITY", "CLOSED", "2026-03-04T10:00:00Z", "SENT");

        JsonNode page = JSON.readTree(getAs(access, "/api/v1/admin/support-requests").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertEquals(4, page.get("totalElements").asInt());
        assertEquals(List.of(closed, data, bug, oldest).stream().map(UUID::toString).toList(), ids(page));
        // The list never carries the full message, only a preview.
        JsonNode first = page.get("items").get(0);
        assertEquals(new TreeSet<>(Set.of("id", "createdAt", "category", "firstName", "lastName", "email", "status",
                "statusChangedAt", "deliveryStatus", "messagePreview")), fieldNames(first));

        assertEquals(List.of(closed.toString(), data.toString()), ids(JSON.readTree(getAs(access,
                "/api/v1/admin/support-requests?size=2").andReturn().getResponse().getContentAsString())));
        assertEquals(List.of(oldest.toString()), ids(JSON.readTree(getAs(access,
                "/api/v1/admin/support-requests?size=1&page=3").andReturn().getResponse().getContentAsString())));
        assertEquals(List.of(oldest.toString()), ids(JSON.readTree(getAs(access,
                "/api/v1/admin/support-requests?category=GENERAL").andReturn().getResponse().getContentAsString())));
        assertEquals(List.of(data.toString(), oldest.toString()), ids(JSON.readTree(getAs(access,
                "/api/v1/admin/support-requests?status=NEW").andReturn().getResponse().getContentAsString())));
        assertEquals(List.of(bug.toString()), ids(JSON.readTree(getAs(access,
                "/api/v1/admin/support-requests?status=IN_PROGRESS&category=BUG").andReturn().getResponse().getContentAsString())));
        assertEquals(List.of(), ids(JSON.readTree(getAs(access,
                "/api/v1/admin/support-requests?status=CLOSED&category=BUG").andReturn().getResponse().getContentAsString())));
        // The size is clamped to 1..100 and a negative page to 0.
        getAs(access, "/api/v1/admin/support-requests?size=1000").andExpect(jsonPath("$.size").value(100));
        getAs(access, "/api/v1/admin/support-requests?size=0&page=-3").andExpect(jsonPath("$.size").value(1))
                .andExpect(jsonPath("$.page").value(0));
        // Unknown filter values are a 400, never an empty list that hides the typo.
        getAs(access, "/api/v1/admin/support-requests?status=DONE").andExpect(status().isBadRequest());
        getAs(access, "/api/v1/admin/support-requests?category=SALES").andExpect(status().isBadRequest());

        JsonNode detail = JSON.readTree(getAs(access, "/api/v1/admin/support-requests/" + data).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertEquals(new TreeSet<>(Set.of("id", "createdAt", "category", "firstName", "lastName", "email", "message",
                "status", "statusChangedAt", "deliveryStatus")), fieldNames(detail));
        assertEquals("DATA_REQUEST", detail.get("category").asText());
        assertEquals("FAILED", detail.get("deliveryStatus").asText());
        assertEquals(data + "@visitor.test", detail.get("email").asText());
        assertEquals("Merhaba, bu bir destek mesajıdır: " + data, detail.get("message").asText());
        getAs(access, "/api/v1/admin/support-requests/" + UUID.randomUUID()).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("SUPPORT_REQUEST_NOT_FOUND"));
        getAs(access, "/api/v1/admin/support-requests/not-a-uuid").andExpect(status().isBadRequest());
    }

    @Test
    void changingTheStatusReturnsTheRequestAuditsARealChangeAndTreatsTheSameStatusAsANoOp() throws Exception {
        User admin = newUser("ADMIN");
        Cookie access = adminAccess(admin);
        UUID id = support("GENERAL", "NEW", "2026-03-05T10:00:00Z", "SENT");
        int auditBefore = audit("SUPPORT_REQUEST_STATUS_CHANGE").size();
        String path = "/api/v1/admin/support-requests/" + id + "/status";

        postAs(access, path, "{\"status\":\"IN_PROGRESS\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id.toString())).andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.message").exists());
        Map<String, Object> row = jdbc.queryForMap("SELECT * FROM support_requests WHERE id = ?", id);
        assertEquals("IN_PROGRESS", row.get("status"));
        assertTrue(((java.sql.Timestamp) row.get("status_changed_at")).after((java.sql.Timestamp) row.get("created_at")));

        List<Map<String, Object>> events = audit("SUPPORT_REQUEST_STATUS_CHANGE");
        assertEquals(auditBefore + 1, events.size());
        Map<String, Object> event = events.get(events.size() - 1);
        assertEquals(admin.getId(), event.get("actor_user_id"));
        assertEquals("SUPPORT_REQUEST", event.get("target_type"));
        assertEquals(id, event.get("target_id"));
        assertEquals("SUCCESS", event.get("outcome"));

        // The same status again changes nothing and writes no event; a closed request can be reopened.
        postAs(access, path, "{\"status\":\"IN_PROGRESS\"}").andExpect(status().isOk());
        assertEquals(auditBefore + 1, audit("SUPPORT_REQUEST_STATUS_CHANGE").size());
        postAs(access, path, "{\"status\":\"CLOSED\"}").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CLOSED"));
        postAs(access, path, "{\"status\":\"NEW\"}").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("NEW"));
        assertEquals(auditBefore + 3, audit("SUPPORT_REQUEST_STATUS_CHANGE").size());

        // Bad input and unknown ids.
        for (String body : new String[] {"{}", "{\"status\":null}", "{\"status\":\"DONE\"}", "{\"status\":\"new\"}", "not json", ""}) {
            postAs(access, path, body).andExpect(status().isBadRequest());
        }
        assertEquals("NEW", jdbc.queryForObject("SELECT status FROM support_requests WHERE id = ?", String.class, id));
        postAs(access, "/api/v1/admin/support-requests/" + UUID.randomUUID() + "/status", "{\"status\":\"CLOSED\"}")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("SUPPORT_REQUEST_NOT_FOUND"));
        assertEquals("FAILURE", audit("SUPPORT_REQUEST_STATUS_CHANGE").getLast().get("outcome"));
    }

    // ---- the audit trail ----------------------------------------------------------------------------------

    @Test
    void userAndSessionActionsAreAuditedWithTheirOutcomeAndNoPersonalData() throws Exception {
        User admin = newUser("ADMIN");
        User target = newUser("USER");
        Cookie access = adminAccess(admin);
        int disabled = audit("USER_DISABLE").size(), enabled = audit("USER_ENABLE").size();
        int revoked = audit("SESSION_REVOKE").size(), revokedAll = audit("SESSION_REVOKE_ALL").size();

        postAs(access, "/api/v1/admin/users/" + target.getId() + "/disable", null).andExpect(status().isOk());
        postAs(access, "/api/v1/admin/users/" + target.getId() + "/disable", null).andExpect(status().isOk());
        assertEquals(disabled + 1, audit("USER_DISABLE").size(), "a no-op is not an event");
        Map<String, Object> disable = audit("USER_DISABLE").getLast();
        assertEquals(admin.getId(), disable.get("actor_user_id"));
        assertEquals("USER", disable.get("target_type"));
        assertEquals(target.getId(), disable.get("target_id"));
        assertEquals("SUCCESS", disable.get("outcome"));

        // Refused by a rule: the administrator cannot disable self.
        postAs(access, "/api/v1/admin/users/" + admin.getId() + "/disable", null).andExpect(status().isConflict());
        Map<String, Object> self = audit("USER_DISABLE").getLast();
        assertEquals("DENIED", self.get("outcome"));
        assertEquals(admin.getId(), self.get("target_id"));
        postAs(access, "/api/v1/admin/users/" + UUID.randomUUID() + "/disable", null).andExpect(status().isNotFound());
        assertEquals("FAILURE", audit("USER_DISABLE").getLast().get("outcome"));

        postAs(access, "/api/v1/admin/users/" + target.getId() + "/enable", null).andExpect(status().isOk());
        postAs(access, "/api/v1/admin/users/" + target.getId() + "/enable", null).andExpect(status().isOk());
        assertEquals(enabled + 1, audit("USER_ENABLE").size());
        assertEquals("SUCCESS", audit("USER_ENABLE").getLast().get("outcome"));

        // One session, then the rest.
        UUID kept = sessions.open(target.getId(), UUID.randomUUID().toString(), java.time.Instant.now().plusSeconds(3_600), "t1");
        sessions.open(target.getId(), UUID.randomUUID().toString(), java.time.Instant.now().plusSeconds(3_600), "t2");
        postAs(access, "/api/v1/admin/users/" + target.getId() + "/sessions/" + kept + "/revoke", null).andExpect(status().isOk());
        assertEquals(revoked + 1, audit("SESSION_REVOKE").size());
        assertEquals("SUCCESS", audit("SESSION_REVOKE").getLast().get("outcome"));
        postAs(access, "/api/v1/admin/users/" + target.getId() + "/sessions/" + kept + "/revoke", null).andExpect(status().isNotFound());
        assertEquals("FAILURE", audit("SESSION_REVOKE").getLast().get("outcome"));
        postAs(access, "/api/v1/admin/users/" + target.getId() + "/sessions/revoke-all", null).andExpect(status().isOk())
                .andExpect(jsonPath("$.revoked").value(1));
        assertEquals(revokedAll + 1, audit("SESSION_REVOKE_ALL").size());
        assertEquals(target.getId(), audit("SESSION_REVOKE_ALL").getLast().get("target_id"));
        postAs(access, "/api/v1/admin/users/" + UUID.randomUUID() + "/sessions/revoke-all", null).andExpect(status().isNotFound());
        assertEquals("FAILURE", audit("SESSION_REVOKE_ALL").getLast().get("outcome"));

        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action || target_type || outcome"
                + " || coalesce(actor_user_id::text, '') || coalesce(target_id::text, '') ~ '(@|example\\.test)'", Integer.class));
    }

    @Test
    void theAuditListFiltersPagesAndNamesTheAccountsWithoutAnyEmail() throws Exception {
        jdbc.update("DELETE FROM admin_audit_events");
        User admin = newUser("ADMIN");
        User target = newUser("USER");
        Cookie access = adminAccess(admin);
        UUID support = UUID.randomUUID();
        UUID unknown = UUID.randomUUID();
        event("2026-03-10T10:00:00Z", admin.getId(), "USER_DISABLE", "USER", target.getId(), "SUCCESS");
        event("2026-03-11T10:00:00Z", admin.getId(), "SUPPORT_REQUEST_STATUS_CHANGE", "SUPPORT_REQUEST", support, "SUCCESS");
        event("2026-03-11T23:30:00Z", null, "ADMIN_SIGN_IN", "SYSTEM", null, "FAILURE");
        event("2026-03-12T10:00:00Z", unknown, "ADMIN_SIGN_IN", "USER", unknown, "DENIED");

        String body = getAs(access, "/api/v1/admin/audit-events").andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(4)).andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("@"), "no e-mail address in the audit list");
        JsonNode page = JSON.readTree(body);
        // Newest first.
        assertEquals(List.of("ADMIN_SIGN_IN", "ADMIN_SIGN_IN", "SUPPORT_REQUEST_STATUS_CHANGE", "USER_DISABLE"),
                page.get("items").findValuesAsText("action"));
        JsonNode disable = page.get("items").get(3);
        assertEquals(new TreeSet<>(Set.of("id", "occurredAt", "actorUserId", "actorNickname", "action", "targetType",
                "targetId", "targetNickname", "outcome")), fieldNames(disable));
        assertEquals(admin.getNickname(), disable.get("actorNickname").asText());
        assertEquals(target.getNickname(), disable.get("targetNickname").asText());
        // A support request target is an id only; an unknown account has no nickname; an unknown actor is null.
        assertTrue(page.get("items").get(2).get("targetNickname").isNull());
        assertTrue(page.get("items").get(1).get("actorUserId").isNull());
        assertTrue(page.get("items").get(0).get("actorNickname").isNull());

        getAs(access, "/api/v1/admin/audit-events?action=ADMIN_SIGN_IN").andExpect(jsonPath("$.totalElements").value(2));
        getAs(access, "/api/v1/admin/audit-events?action=USER_ENABLE").andExpect(jsonPath("$.totalElements").value(0));
        getAs(access, "/api/v1/admin/audit-events?size=1&page=1").andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].action").value("ADMIN_SIGN_IN")).andExpect(jsonPath("$.totalElements").value(4));
        getAs(access, "/api/v1/admin/audit-events?size=500").andExpect(jsonPath("$.size").value(100));
        // The inclusive day range is cut in the requested zone: 23:30 UTC on the 11th is the 12th in Istanbul.
        getAs(access, "/api/v1/admin/audit-events?from=2026-03-11&to=2026-03-11").andExpect(jsonPath("$.totalElements").value(2));
        getAs(access, "/api/v1/admin/audit-events?from=2026-03-11&to=2026-03-11&zone=Europe/Istanbul")
                .andExpect(jsonPath("$.totalElements").value(1));
        getAs(access, "/api/v1/admin/audit-events?from=2026-03-12").andExpect(jsonPath("$.totalElements").value(1));
        getAs(access, "/api/v1/admin/audit-events?to=2026-03-10").andExpect(jsonPath("$.totalElements").value(1));
        getAs(access, "/api/v1/admin/audit-events?from=2026-03-12&to=2026-03-10").andExpect(status().isBadRequest());
        getAs(access, "/api/v1/admin/audit-events?from=2020-01-01&to=2026-01-01").andExpect(status().isBadRequest());
        getAs(access, "/api/v1/admin/audit-events?action=DROP_TABLE").andExpect(status().isBadRequest());
        getAs(access, "/api/v1/admin/audit-events?zone=Mars/Base").andExpect(status().isBadRequest());
        getAs(access, "/api/v1/admin/audit-events?from=yesterday").andExpect(status().isBadRequest());
    }

    private void event(String at, UUID actor, String action, String targetType, UUID target, String outcome) {
        jdbc.update("INSERT INTO admin_audit_events (id, occurred_at, actor_user_id, action, target_type, target_id, outcome)"
                + " VALUES (?, ?::timestamptz, ?, ?, ?, ?, ?)", UUID.randomUUID(), at, actor, action, targetType, target, outcome);
    }

    @Test
    void theUserDetailShowsTheRolePermissionsReadOnly() throws Exception {
        User admin = newUser("ADMIN");
        User member = newUser("USER");
        Cookie access = adminAccess(admin);
        getAs(access, "/api/v1/admin/users/" + member.getId()).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.globalRole").value("USER")).andExpect(jsonPath("$.platformPermissions.length()").value(0))
                .andExpect(jsonPath("$.activeSessions").value(0)).andExpect(jsonPath("$.linkedProviders").isArray())
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
        String adminDetail = getAs(access, "/api/v1/admin/users/" + admin.getId()).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> permissions = new ArrayList<>();
        JSON.readTree(adminDetail).get("platformPermissions").forEach(node -> permissions.add(node.asText()));
        assertEquals(List.of("AUDIT_VIEW", "SESSION_MANAGE", "SYSTEM_VIEW", "USER_MANAGE"), permissions, adminDetail);
    }

    // ---- the system status ----------------------------------------------------------------------------------

    @Test
    void theSystemStatusReportsJobsSessionsErrorCountersAndFlagsButNoSecrets() throws Exception {
        User admin = newUser("ADMIN");
        Cookie access = adminAccess(admin);
        JsonNode before = JSON.readTree(getAs(access, "/api/v1/admin/system/status").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());

        assertEquals("UP", before.get("status").asText());
        assertTrue(before.get("database").asBoolean());
        assertTrue(before.get("totpEncryptionKeyConfigured").asBoolean());
        assertFalse(before.get("mailEnabled").asBoolean());
        assertEquals(jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE revoked_at IS NULL AND expires_at > now()",
                Long.class), before.get("activeSessions").asLong());
        List<String> jobs = before.get("scheduledJobs").findValuesAsText("name");
        assertTrue(jobs.containsAll(List.of("retention.analytics", "retention.audit", "retention.contact",
                "retention.user-sessions", "auth.pending-registration-cleanup", "task.deadline-scan",
                "project.repository-commit-scan")), jobs.toString());
        for (JsonNode job : before.get("scheduledJobs")) {
            assertEquals(new TreeSet<>(Set.of("name", "lastRunAt", "lastOutcome", "lastAffected")), fieldNames(job));
        }

        // Two refused calls (401 and 403) are client errors; the status calls themselves (200) are not counted.
        getAs(null, "/api/v1/admin/system/status").andExpect(status().isUnauthorized());
        getAs(AdminSessionFactory.unmarked(sessions, tokens, admin.getId())[0], "/api/v1/admin/system/status")
                .andExpect(status().isForbidden());
        String afterBody = getAs(access, "/api/v1/admin/system/status").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode after = JSON.readTree(afterBody);
        assertEquals(before.get("httpErrorsLast24h").get("clientErrors").asLong() + 2,
                after.get("httpErrorsLast24h").get("clientErrors").asLong());
        assertEquals(before.get("httpErrorsLast24h").get("serverErrors").asLong(),
                after.get("httpErrorsLast24h").get("serverErrors").asLong());

        // Only booleans and numbers: neither key value nor any connection setting is part of the answer.
        assertFalse(afterBody.contains(Base64.getEncoder().encodeToString(TOTP_KEY)));
        assertFalse(afterBody.contains(Base64.getEncoder().encodeToString(JWT_KEY)));
        assertFalse(afterBody.contains(postgres.getPassword()));
    }

    // ---- analytics behaviour reports --------------------------------------------------------------------------

    @Test
    void theDashboardCarriesPageFlowCtaConversionAndClientErrorReportsForTheRange() throws Exception {
        jdbc.update("DELETE FROM analytics_sessions");
        User admin = newUser("ADMIN");
        Cookie access = adminAccess(admin);
        UUID s1 = analyticsSession("2026-03-10T10:00:00Z", "/", "SEARCH", "google.com", null, null, null);
        view(s1, "/", "2026-03-10T10:00:00Z");
        view(s1, "/register", "2026-03-10T10:01:00Z");
        view(s1, "/login", "2026-03-10T10:02:00Z");
        cta(s1, "register_submit", "2026-03-10T10:03:00Z");
        UUID s2 = analyticsSession("2026-03-11T09:00:00Z", "/", "DIRECT", null, null, null, null);
        view(s2, "/", "2026-03-11T09:00:00Z");
        view(s2, "/pricing", "2026-03-11T09:01:00Z");
        cta(s2, "landing_register", "2026-03-11T09:00:30Z");
        UUID s3 = analyticsSession("2026-03-11T12:00:00Z", "/", "CAMPAIGN", null, "newsletter", "email", "launch");
        view(s3, "/", "2026-03-11T12:00:00Z");
        cta(s3, "landing_register", "2026-03-11T12:00:20Z");
        cta(s3, "register_submit", "2026-03-11T12:02:00Z");
        UUID s4 = analyticsSession("2026-03-12T08:00:00Z", "/not-found", "REFERRAL", "example.org", null, null, null);
        view(s4, "/not-found", "2026-03-12T08:00:00Z");
        view(s4, "/", "2026-03-12T08:01:00Z");
        error(s4, "/projects/[slug]", "RENDER", "2026-03-12T08:02:00Z");
        error(s4, "/dashboard", "CHUNK_LOAD", "2026-03-12T08:03:00Z");
        // Outside the range: must not show up anywhere.
        UUID outside = analyticsSession("2026-03-01T08:00:00Z", "/old", "DIRECT", null, null, null, null);
        view(outside, "/old", "2026-03-01T08:00:00Z");
        cta(outside, "register_submit", "2026-03-01T08:01:00Z");
        error(outside, "/old", "NETWORK", "2026-03-01T08:02:00Z");

        JsonNode behavior = JSON.readTree(getAs(access, "/api/v1/admin/analytics?from=2026-03-10&to=2026-03-13")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("behavior");

        assertEquals(List.of("/", "/login", "/not-found", "/pricing", "/register"),
                behavior.get("topPages").findValuesAsText("path"));
        assertEquals(List.of(4L, 1L, 1L, 1L, 1L), longs(behavior.get("topPages"), "views"));
        assertEquals(List.of(4L, 1L, 1L, 1L, 1L), longs(behavior.get("topPages"), "sessions"));

        assertEquals(List.of("/", "/not-found"), behavior.get("entryPages").findValuesAsText("path"));
        assertEquals(List.of(3L, 1L), longs(behavior.get("entryPages"), "sessions"));

        assertEquals(List.of("/", "/login", "/pricing"), behavior.get("exitPages").findValuesAsText("path"));
        assertEquals(List.of(2L, 1L, 1L), longs(behavior.get("exitPages"), "sessions"));

        assertEquals(List.of("/>/pricing", "/>/register", "/not-found>/"), flows(behavior.get("flows")));
        assertEquals(1, behavior.get("notFound").get("views").asInt());
        assertEquals(1, behavior.get("notFound").get("sessions").asInt());

        JsonNode ctas = behavior.get("ctas");
        assertEquals(List.of("landing_register", "register_submit"), ctas.findValuesAsText("ctaId"));
        assertEquals(List.of(2L, 2L), longs(ctas, "clicks"));
        assertEquals(List.of(2L, 2L), longs(ctas, "sessions"));

        JsonNode conversions = behavior.get("conversions");
        assertEquals(4, conversions.get("sessions").asInt());
        assertEquals(2, conversions.get("converted").asInt());
        assertEquals(List.of("CAMPAIGN", "SEARCH", "DIRECT", "REFERRAL"), conversions.get("bySource").findValuesAsText("source"));
        assertEquals(List.of(1L, 1L, 0L, 0L), longs(conversions.get("bySource"), "converted"));
        assertEquals(1, conversions.get("byCampaign").size());
        assertEquals("launch", conversions.get("byCampaign").get(0).get("campaign").asText());
        assertEquals("newsletter", conversions.get("byCampaign").get(0).get("source").asText());
        assertEquals(1, conversions.get("byCampaign").get(0).get("converted").asInt());

        JsonNode errors = behavior.get("clientErrors");
        assertEquals(2, errors.get("total").asInt());
        assertEquals(List.of("chunk_load", "render"), errors.get("byKind").findValuesAsText("kind"));
        assertEquals(List.of("/dashboard", "/projects/[slug]"), errors.get("byRoute").findValuesAsText("path"));
        assertEquals(List.of("chunk_load", "render"), errors.get("byRoute").findValuesAsText("kind"));

        // An empty range gives empty lists and zero counts, never nulls.
        JsonNode empty = JSON.readTree(getAs(access, "/api/v1/admin/analytics?from=2025-01-01&to=2025-01-02")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("behavior");
        assertEquals(0, empty.get("topPages").size());
        assertEquals(0, empty.get("notFound").get("views").asInt());
        assertEquals(0, empty.get("conversions").get("sessions").asInt());
        assertEquals(0, empty.get("clientErrors").get("total").asInt());
    }

    private UUID analyticsSession(String startedAt, String entry, String source, String referrer, String utmSource,
                                  String utmMedium, String utmCampaign) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO analytics_sessions (id, visitor_id, started_at, last_seen_at, engaged_seconds, page_views,
                    entry_path, source_type, referrer_domain, utm_source, utm_medium, utm_campaign, consent_version)
                VALUES (?, ?, ?::timestamptz, ?::timestamptz, 0, 0, ?, ?, ?, ?, ?, ?, 1)
                """, id, UUID.randomUUID(), startedAt, startedAt, entry, source, referrer, utmSource, utmMedium, utmCampaign);
        return id;
    }

    private void view(UUID session, String path, String at) {
        jdbc.update("INSERT INTO analytics_page_views (id, session_id, path, occurred_at) VALUES (?, ?, ?, ?::timestamptz)",
                UUID.randomUUID(), session, path, at);
    }

    private void cta(UUID session, String id, String at) {
        jdbc.update("INSERT INTO analytics_cta_clicks (id, session_id, cta_id, occurred_at) VALUES (?, ?, ?, ?::timestamptz)",
                UUID.randomUUID(), session, id, at);
    }

    private void error(UUID session, String path, String kind, String at) {
        jdbc.update("INSERT INTO analytics_client_errors (id, session_id, path, error_kind, occurred_at)"
                + " VALUES (?, ?, ?, ?, ?::timestamptz)", UUID.randomUUID(), session, path, kind, at);
    }

    // ---- JSON helpers -----------------------------------------------------------------------------------------

    private static List<String> ids(JsonNode page) {
        List<String> ids = new ArrayList<>();
        page.get("items").forEach(item -> ids.add(item.get("id").asText()));
        return ids;
    }

    private static Set<String> fieldNames(JsonNode node) {
        Set<String> names = new TreeSet<>();
        node.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static List<Long> longs(JsonNode array, String field) {
        List<Long> values = new ArrayList<>();
        array.forEach(item -> values.add(item.get(field).asLong()));
        return values;
    }

    private static List<String> flows(JsonNode array) {
        List<String> values = new ArrayList<>();
        array.forEach(item -> values.add(item.get("fromPath").asText() + ">" + item.get("toPath").asText()));
        return values;
    }
}
