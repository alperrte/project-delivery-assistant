package com.pda.admin.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import com.pda.admin.infrastructure.bootstrap.AdminBootstrapRunner;
import com.pda.user.GlobalRole;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
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

/** Admin bootstrap, the kept forced-password-change mechanism and the admin API security boundary. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class AdminIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }
    private static final byte[] TOTP_KEY = new byte[32];
    static { new SecureRandom().nextBytes(TOTP_KEY); }

    private static final String ADMIN_EMAIL = "root.admin@example.test";
    private static final String INITIAL_PASSWORD = "Initial-Password-123";
    private static final String NEW_PASSWORD = "Brand-New-Password-456";

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("ADMIN_EMAIL", () -> ADMIN_EMAIL);
        registry.add("ADMIN_INITIAL_PASSWORD", () -> INITIAL_PASSWORD);
        registry.add("TOTP_ENCRYPTION_KEY", () -> Base64.getEncoder().encodeToString(TOTP_KEY));
        registry.add("GOOGLE_CLIENT_ID", () -> "google-id-secret-marker");
        registry.add("GOOGLE_CLIENT_SECRET", () -> "google-secret-value-marker");
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;
    @Autowired AdminBootstrapRunner runner;
    @Autowired com.pda.user.UserAdministration administration;
    @Autowired com.pda.user.UserSessions sessions;
    @Autowired com.pda.auth.application.service.JwtTokens tokens;

    @Test
    @Order(1)
    void bootstrapCreatedOneActiveVerifiedAdminWithAHashedPasswordAndNoForcedChange() {
        assertEquals(1, users.countByGlobalRole(GlobalRole.ADMIN));
        User admin = users.findByEmail(ADMIN_EMAIL).orElseThrow();
        assertEquals(GlobalRole.ADMIN, admin.getGlobalRole());
        assertEquals("ACTIVE", admin.getAccountStatus().name());
        assertEquals("VERIFIED", admin.getEmailVerificationStatus().name());
        assertFalse(admin.isMustChangePassword(), "the ENV administrator is not sent to a forced password change");
        assertNotNull(hash(ADMIN_EMAIL));
        assertFalse(hash(ADMIN_EMAIL).contains(INITIAL_PASSWORD));
        assertTrue(encoder.matches(INITIAL_PASSWORD, hash(ADMIN_EMAIL)));
    }

    @Test
    @Order(2)
    void restartDoesNotCreateASecondAdminOrOverwriteTheAccount() throws Exception {
        String hashBefore = hash(ADMIN_EMAIL);
        runner.run(new DefaultApplicationArguments());
        runner.run(new DefaultApplicationArguments());
        assertEquals(1, users.countByGlobalRole(GlobalRole.ADMIN));
        assertEquals(hashBefore, hash(ADMIN_EMAIL));
    }

    @Test
    @Order(3)
    void existingNonAdminAccountWithTheSameEmailIsNeverPromoted() throws Exception {
        User victim = newUser("USER");
        jdbc.update("UPDATE users SET global_role = 'USER' WHERE email = ?", ADMIN_EMAIL);
        assertEquals(0, users.countByGlobalRole(GlobalRole.ADMIN));
        String hashBefore = hash(victim.getEmail());
        new AdminBootstrapRunner(administration, victim.getEmail(), "Some-Long-Password-1")
                .run(new DefaultApplicationArguments());
        assertEquals(GlobalRole.USER, users.findByEmail(victim.getEmail()).orElseThrow().getGlobalRole());
        assertEquals(hashBefore, hash(victim.getEmail()));
        assertEquals(0, users.countByGlobalRole(GlobalRole.ADMIN));
        jdbc.update("UPDATE users SET global_role = 'ADMIN' WHERE email = ?", ADMIN_EMAIL);
        assertEquals(1, users.countByGlobalRole(GlobalRole.ADMIN));
    }

    @Test
    @Order(4)
    void weakOrPlaceholderPasswordIsSkipped() throws Exception {
        long before = users.count();
        new AdminBootstrapRunner(administration, "weak@example.test", "change_me")
                .run(new DefaultApplicationArguments());
        new AdminBootstrapRunner(administration, "not-an-email", "Long-Enough-Password-1")
                .run(new DefaultApplicationArguments());
        new AdminBootstrapRunner(administration, "", "").run(new DefaultApplicationArguments());
        assertEquals(before, users.count());
    }

    @Test
    @Order(5)
    void theKeptForcedPasswordChangeMechanismBlocksEverythingUntilThePasswordIsChanged() throws Exception {
        Cookie csrf = csrfCookie();
        // The ENV administrator no longer carries the flag; the mechanism stays for any account that does.
        jdbc.update("UPDATE users SET must_change_password = TRUE WHERE email = ?", ADMIN_EMAIL);
        Cookie access = adminAccess();

        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(true));
        mvc.perform(get("/api/v1/admin/users").cookie(access)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("password_change_required"));
        mvc.perform(get("/api/v1/auth/sessions").cookie(access)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("password_change_required"));

        // a second session must be revoked by the change
        Cookie other = adminAccess();

        mvc.perform(limited("/api/v1/auth/password/change").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content(change("wrong-current-password", NEW_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isBadRequest());
        mvc.perform(limited("/api/v1/auth/password/change").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content(change(INITIAL_PASSWORD, INITIAL_PASSWORD, INITIAL_PASSWORD)))
                .andExpect(status().isBadRequest());
        mvc.perform(limited("/api/v1/auth/password/change").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content(change(INITIAL_PASSWORD, NEW_PASSWORD, "different")))
                .andExpect(status().isBadRequest());
        mvc.perform(limited("/api/v1/auth/password/change").cookie(access)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(change(INITIAL_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isForbidden());
        mvc.perform(limited("/api/v1/auth/password/change").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content(change(INITIAL_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isUnauthorized());

        mvc.perform(limited("/api/v1/auth/password/change").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content(change(INITIAL_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)))
                .andExpect(status().isOk());

        assertFalse(users.findByEmail(ADMIN_EMAIL).orElseThrow().isMustChangePassword());
        mvc.perform(get("/api/v1/auth/me").cookie(other)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isOk());

        // the initial password no longer works on the administrator sign-in; the new one does (no forced change, first-time enrolment)
        mvc.perform(limited("/api/v1/auth/admin/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + INITIAL_PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(limited("/api/v1/auth/admin/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + NEW_PASSWORD + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("TWO_FACTOR_ENROLLMENT_REQUIRED"));

        // a restart with the same env must not reset the changed password
        runner.run(new DefaultApplicationArguments());
        assertTrue(encoder.matches(NEW_PASSWORD, hash(ADMIN_EMAIL)));
    }

    @Test
    @Order(6)
    void adminApiRejectsAnonymousAndNonAdminCallers() throws Exception {
        Cookie csrf = csrfCookie();
        User member = newUser("USER");
        Cookie access = login(member.getEmail(), "Member-Password-1", csrf)[0];
        UUID target = member.getId();

        for (String path : new String[] {"/api/v1/admin/users", "/api/v1/admin/users/" + target,
                "/api/v1/admin/users/" + target + "/sessions", "/api/v1/admin/overview",
                "/api/v1/admin/projects", "/api/v1/admin/system/status"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).cookie(access)).andExpect(status().isForbidden());
        }
        for (String path : new String[] {"/api/v1/admin/users/" + target + "/disable",
                "/api/v1/admin/users/" + target + "/enable",
                "/api/v1/admin/users/" + target + "/sessions/revoke-all"}) {
            mvc.perform(post(path).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isUnauthorized());
            mvc.perform(post(path).cookie(csrf, access).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
        }
        assertEquals("ACTIVE", users.findById(target).orElseThrow().getAccountStatus().name());
    }

    @Test
    @Order(7)
    void adminManagesUsersAndSafetyRulesHold() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie admin = adminAccess();
        User victim = newUser("USER");
        Cookie[] victimTokens = login(victim.getEmail(), "Member-Password-1", csrf);

        mvc.perform(post("/api/v1/admin/users/" + victim.getId() + "/enable").cookie(admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden()); // CSRF is enforced

        mvc.perform(get("/api/v1/admin/users?size=1000").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(100))
                .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.items[0].email").exists());
        mvc.perform(get("/api/v1/admin/users/" + victim.getId()).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.activeSessions").value(1))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/admin/users/" + UUID.randomUUID()).cookie(admin))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/admin/users/not-a-uuid").cookie(admin)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users/" + victim.getId() + "/sessions").cookie(admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));

        // an administrator can neither disable self nor the last active administrator
        UUID adminId = users.findByEmail(ADMIN_EMAIL).orElseThrow().getId();
        mvc.perform(post("/api/v1/admin/users/" + adminId + "/disable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict());
        User secondAdmin = newUser("ADMIN");
        Cookie second = AdminSessionFactory.verified(sessions, tokens, secondAdmin.getId())[0];
        mvc.perform(post("/api/v1/admin/users/" + secondAdmin.getId() + "/disable").cookie(csrf, second)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/admin/users/" + secondAdmin.getId() + "/disable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").cookie(second)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/admin/users/" + adminId + "/disable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict());

        // disabling revokes sessions and blocks login; enabling restores access
        mvc.perform(post("/api/v1/admin/users/" + victim.getId() + "/disable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").cookie(victimTokens[0])).andExpect(status().isUnauthorized());
        mvc.perform(limited("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + victim.getEmail() + "\",\"password\":\"Member-Password-1\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/admin/users/" + victim.getId() + "/enable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        Cookie[] again = login(victim.getEmail(), "Member-Password-1", csrf);

        // session revocation
        mvc.perform(post("/api/v1/admin/users/" + UUID.randomUUID() + "/sessions/revoke-all").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        UUID sessionId = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM user_sessions WHERE user_id = ? AND revoked_at IS NULL", String.class,
                victim.getId()));
        mvc.perform(post("/api/v1/admin/users/" + victim.getId() + "/sessions/" + sessionId + "/revoke")
                        .cookie(csrf, admin).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").cookie(again[0])).andExpect(status().isUnauthorized());
        Cookie[] third = login(victim.getEmail(), "Member-Password-1", csrf);
        mvc.perform(post("/api/v1/admin/users/" + victim.getId() + "/sessions/revoke-all").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revoked").value(1));
        mvc.perform(get("/api/v1/auth/me").cookie(third[0])).andExpect(status().isUnauthorized());
    }

    @Test
    @Order(8)
    void overviewAndStatusExposeNoSecretsOrProjectContent() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie admin = adminAccess();

        mvc.perform(get("/api/v1/admin/overview").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.users.total").isNumber()).andExpect(jsonPath("$.projects.total").isNumber());
        mvc.perform(get("/api/v1/admin/projects?page=0&size=5").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray());
        String body = mvc.perform(get("/api/v1/admin/system/status").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.database").value(true))
                .andExpect(jsonPath("$.googleLoginConfigured").value(true))
                .andExpect(jsonPath("$.githubLoginConfigured").value(false))
                .andReturn().getResponse().getContentAsString();
        assertFalse(body.contains("marker"));
        assertFalse(body.contains(new String(Base64.getEncoder().encode(JWT_KEY))));
        assertFalse(body.contains(postgres.getPassword()));
        assertFalse(body.contains(INITIAL_PASSWORD));
    }

    @Test
    @Order(9)
    void adminHasNoImplicitAccessToProjectsTheyAreNotAMemberOf() throws Exception {
        Cookie csrf = csrfCookie();
        User owner = newUser("USER");
        Cookie ownerAccess = login(owner.getEmail(), "Member-Password-1", csrf)[0];
        String created = mvc.perform(post("/api/v1/projects").cookie(csrf, ownerAccess)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Admin Boundary Project\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        String projectId = com.jayway.jsonpath.JsonPath.read(created, "$.id");
        Cookie admin = adminAccess();

        mvc.perform(get("/api/v1/projects/" + projectId).cookie(admin)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/archive").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        // the overview lists the project by name/status only
        mvc.perform(get("/api/v1/admin/projects").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.name=='Admin Boundary Project')].activeMembers").value(1))
                .andExpect(jsonPath("$.items[0].description").doesNotExist());
    }

    @Test
    @Order(10)
    void listFiltersOnTheServerAndProblemBodiesCarryStableCodes() throws Exception {
        Cookie csrf = csrfCookie();
        Cookie admin = adminAccess();
        String stem = "qz" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        User wanted = users.saveAndFlush(User.registerLocalActive(stem + "@example.test", stem + "nick",
                "Member-Password-1", encoder));
        User other = newUser("USER");

        // Search: case-insensitive substring of nickname or email, answered with a server page.
        mvc.perform(get("/api/v1/admin/users?search=" + stem.toUpperCase()).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(wanted.getId().toString()))
                .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/admin/users?search=" + stem + "NICK").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));
        // Wildcards are literal characters, never patterns.
        mvc.perform(get("/api/v1/admin/users?search=%25").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/admin/users?search=" + "x".repeat(101)).cookie(admin)).andExpect(status().isBadRequest());

        // Status filter, combined with search and paging.
        mvc.perform(get("/api/v1/admin/users?status=DISABLED&search=" + stem).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post("/api/v1/admin/users/" + wanted.getId() + "/disable").cookie(csrf, admin)
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/users?status=DISABLED&search=" + stem).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].accountStatus").value("DISABLED"));
        mvc.perform(get("/api/v1/admin/users?status=ACTIVE&search=" + stem).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/admin/users?status=ACTIVE&size=1&page=0").cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(1)).andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].accountStatus").value("ACTIVE"));
        mvc.perform(get("/api/v1/admin/users?status=TERMINATED").cookie(admin)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users?status=NOT_A_STATUS").cookie(admin)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users?status=DELETED").cookie(admin)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/admin/users?status=PENDING_VERIFICATION").cookie(admin)).andExpect(status().isOk());

        // Disabling is reversible, never a delete, and keeps the row.
        assertTrue(users.findById(wanted.getId()).isPresent());
        mvc.perform(post("/api/v1/admin/users/" + wanted.getId() + "/enable").cookie(csrf, admin)
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/users?status=ACTIVE&search=" + stem).cookie(admin)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1));

        // Stable problem codes.
        UUID adminId = users.findByEmail(ADMIN_EMAIL).orElseThrow().getId();
        mvc.perform(post("/api/v1/admin/users/" + adminId + "/disable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ADMIN_SELF_DENIED"));
        mvc.perform(post("/api/v1/admin/users/" + UUID.randomUUID() + "/disable").cookie(csrf, admin)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
        mvc.perform(get("/api/v1/admin/users/" + UUID.randomUUID()).cookie(admin)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));

        // A normal account, with or without the new parameters, gets nothing; so does an anonymous caller.
        Cookie member = login(other.getEmail(), "Member-Password-1", csrf)[0];
        mvc.perform(get("/api/v1/admin/users?search=" + stem + "&status=ACTIVE").cookie(member))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/users?search=" + stem)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/admin/users/" + wanted.getId() + "/disable").cookie(csrf, member)
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isForbidden());
        assertEquals("ACTIVE", users.findById(wanted.getId()).orElseThrow().getAccountStatus().name());
    }

    @Test
    @Order(11)
    void registrationReportCountsAccountsByDayInTheRequestedZoneFromTheUserTable() {
        java.time.Instant now = java.time.Instant.now();
        var report = administration.registrations(now.minus(java.time.Duration.ofDays(2)),
                now.plus(java.time.Duration.ofDays(1)), java.time.ZoneId.of("Europe/Istanbul"));
        assertEquals(users.count(), report.inRange());
        assertEquals(report.inRange(), report.daily().stream().mapToLong(com.pda.user.UserAdministration.DailyCount::count).sum());
        // Outside the range nothing is counted.
        var empty = administration.registrations(now.plus(java.time.Duration.ofDays(2)),
                now.plus(java.time.Duration.ofDays(3)), java.time.ZoneId.of("UTC"));
        assertEquals(0, empty.inRange());
        assertTrue(empty.daily().isEmpty());
    }

    private static final java.util.concurrent.atomic.AtomicInteger IPS = new java.util.concurrent.atomic.AtomicInteger();

    /** POST to a rate-limited path from a fresh client address so tests do not exhaust each other's budget. */
    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder limited(String path) {
        String address = "admin-test-" + IPS.incrementAndGet();
        return post(path).with(request -> { request.setRemoteAddr(address); return request; });
    }

    /** A session as the administrator sign-in leaves it; the real sign-in is covered by AdminAuthIntegrationTest. */
    private Cookie adminAccess() {
        UUID id = users.findByEmail(ADMIN_EMAIL).orElseThrow().getId();
        return AdminSessionFactory.verified(sessions, tokens, id)[0];
    }

    private String hash(String email) {
        return jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email);
    }

    private User newUser(String role) {
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), "Member-Password-1", encoder));
        if (!"USER".equals(role)) {
            jdbc.update("UPDATE users SET global_role = ? WHERE id = ?", role, user.getId());
        }
        return users.findById(user.getId()).orElseThrow();
    }

    private static String change(String current, String next, String confirm) {
        return "{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next
                + "\",\"confirmNewPassword\":\"" + confirm + "\"}";
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    /** Returns {access, refresh}. */
    private Cookie[] login(String email, String password, Cookie csrf) throws Exception {
        var headers = mvc.perform(limited("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        return new Cookie[] {cookie(headers, "PDA_ACCESS"), cookie(headers, "PDA_REFRESH")};
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        return new Cookie(name, value);
    }
}
