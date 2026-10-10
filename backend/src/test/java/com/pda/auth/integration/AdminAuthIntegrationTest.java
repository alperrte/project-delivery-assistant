package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pda.BackendApplication;
import com.pda.auth.application.service.JwtTokens;
import com.pda.user.UserSessions;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * The separate administrator sign-in through the whole stack: administrators are refused by the regular sign-in, the
 * password alone yields only a single-use ticket, the authenticator step (or first-time enrolment) opens the only kind
 * of session the administrator API accepts. The application runs on a clock the test moves; the codes come from an
 * independent RFC 6238 implementation (the phone) that is not the production class.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import(SessionExpiryIntegrationTest.MovableClockConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@ExtendWith(OutputCaptureExtension.class)
class AdminAuthIntegrationTest {

    private static final byte[] JWT_KEY = randomKey();
    private static final byte[] TOTP_KEY = randomKey();
    private static final String ENV_ADMIN_EMAIL = "env.admin@example.test";
    private static final String ENV_ADMIN_PASSWORD = "Initial-Password-123";

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("TOTP_ENCRYPTION_KEY", () -> Base64.getEncoder().encodeToString(TOTP_KEY));
        registry.add("ADMIN_EMAIL", () -> ENV_ADMIN_EMAIL);
        registry.add("ADMIN_INITIAL_PASSWORD", () -> ENV_ADMIN_PASSWORD);
        registry.add("auth.rate-limit.sensitive-max-requests", () -> "1000");
        registry.add("auth.rate-limit.login-max-requests", () -> "1000");
        registry.add("auth.rate-limit.refresh-max-requests", () -> "1000");
    }

    private static final String PASSWORD = "Strong-Pass1";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String ENROLL = "PDA_ADMIN_ENROLL";
    private static final String MFA = "PDA_ADMIN_MFA";

    @Autowired MockMvc mvc;
    @Autowired SessionExpiryIntegrationTest.MovableClock clock;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired BCryptPasswordEncoder encoder;
    @Autowired UserSessions sessions;
    @Autowired JwtTokens tokens;

    @BeforeEach
    void stepBoundary() {
        // A step boundary keeps "the next code" arithmetic simple.
        clock.set(Instant.ofEpochSecond(Instant.now().getEpochSecond() / 30 * 30 + 1));
    }

    // ---- the regular sign-in refuses administrators ------------------------------------------------------

    @Test
    void theRegularSignInAnswersAnAdministratorExactlyLikeAWrongPasswordAndStillWorksForUsers() throws Exception {
        Account admin = newAdmin();
        Account user = newUser();

        String wrongPassword = login(user.email, "Wrong-Pass1").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        MockHttpServletResponse adminResponse = login(admin.email, PASSWORD).andExpect(status().isUnauthorized())
                .andReturn().getResponse();
        assertEquals(wrongPassword, adminResponse.getContentAsString());
        assertNoSignInCookies(adminResponse);
        assertNull(adminResponse.getCookie("PDA_MFA"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, admin.id));

        // An administrator with two-factor on gets no regular second step either.
        Enrolment enrolled = enrol(admin);
        MockHttpServletResponse withTwoFactor = login(admin.email, PASSWORD).andExpect(status().isUnauthorized())
                .andReturn().getResponse();
        assertEquals(wrongPassword, withTwoFactor.getContentAsString());
        assertNull(withTwoFactor.getCookie("PDA_MFA"));
        assertNotNull(enrolled.access);

        // An ordinary user is unaffected.
        MockHttpServletResponse ok = login(user.email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse();
        assertNotNull(ok.getCookie("PDA_ACCESS"));
        assertNotNull(ok.getCookie("PDA_REFRESH"));
    }

    @Test
    void theRegularSecondStepRefusesAnAdministratorToo() throws Exception {
        Account admin = newAdmin();
        Enrolment enrolled = enrol(admin);
        // A genuine regular PDA_MFA ticket cannot exist for an administrator; even a user who was promoted after the
        // password step is refused when the second step arrives.
        Account promoted = newUser();
        enableTwoFactor(promoted);
        Cookie pending = login(promoted.email, PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED")).andReturn().getResponse().getCookie("PDA_MFA");
        assertNotNull(pending);
        int sessionsBefore = jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, promoted.id);
        jdbc.update("UPDATE users SET global_role = 'ADMIN' WHERE id = ?", promoted.id);
        clock.advance(Duration.ofSeconds(30));
        postJson("/api/v1/auth/login/2fa", "{\"code\":\"" + code(secretOf(promoted)) + "\"}", pending)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("two_factor_code_invalid"));
        assertEquals(sessionsBefore, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, promoted.id));
        assertNotNull(enrolled.access);
    }

    // ---- the administrator sign-in: password step ---------------------------------------------------------

    @Test
    void everyIneligibleAccountGetsTheSameAnswerOnTheAdministratorSignIn() throws Exception {
        Account admin = newAdmin();
        Account user = newUser();
        Account disabled = newAdmin();
        jdbc.update("UPDATE users SET account_status = 'DISABLED' WHERE id = ?", disabled.id);

        String reference = withoutInstance(adminLogin(admin.email, "Wrong-Pass1").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString());
        for (String[] attempt : new String[][] {{user.email, PASSWORD}, {UUID.randomUUID() + "@example.test", PASSWORD},
                {admin.email, "Wrong-Pass1"}, {disabled.email, PASSWORD}}) {
            MockHttpServletResponse response = adminLogin(attempt[0], attempt[1]).andExpect(status().isUnauthorized())
                    .andReturn().getResponse();
            assertEquals(reference, withoutInstance(response.getContentAsString()));
            assertNoSignInCookies(response);
            assertNull(response.getCookie(ENROLL));
            assertNull(response.getCookie(MFA));
        }
        // The regular sign-in answers a wrong password with the very same body.
        assertEquals(reference, withoutInstance(login(user.email, "Wrong-Pass1").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString()));
    }

    // ---- first sign-in: enrolment (tests 5, 6, 8) ---------------------------------------------------------

    @Test
    void theFirstAdministratorSignInEnrolsAnAuthenticatorAndOnlyTheFirstRightCodeOpensASession(CapturedOutput output)
            throws Exception {
        Account admin = newAdmin();

        MockHttpServletResponse first = adminLogin(admin.email, PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_ENROLLMENT_REQUIRED")).andReturn().getResponse();
        assertNoSignInCookies(first);
        Cookie ticket = first.getCookie(ENROLL);
        assertNotNull(ticket);
        assertTrue(ticket.isHttpOnly());
        assertEquals("/api/v1/auth/admin/2fa", ticket.getPath());
        assertEquals(600, ticket.getMaxAge());
        assertTrue(first.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .anyMatch(value -> value.startsWith(ENROLL + "=") && value.contains("SameSite=Lax")));
        assertEquals("no-store", first.getHeader("Cache-Control"));
        assertFalse(isTwoFactorOn(admin.id));

        // The password alone, and the ticket, open nothing: they are not an access token.
        mvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/users").cookie(new Cookie("PDA_ACCESS", ticket.getValue())))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/users").cookie(ticket)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("PDA_ACCESS", ticket.getValue())))
                .andExpect(status().isUnauthorized());

        MockHttpServletResponse setupResponse = postJson("/api/v1/auth/admin/2fa/setup", null, ticket)
                .andExpect(status().isOk()).andReturn().getResponse();
        assertEquals("no-store", setupResponse.getHeader("Cache-Control"));
        JsonNode setup = JSON.readTree(setupResponse.getContentAsString());
        String secret = setup.get("secret").asText();
        String uri = setup.get("otpauthUri").asText();
        assertTrue(uri.startsWith("otpauth://totp/PDA:"));
        assertTrue(uri.contains("secret=" + secret));
        assertTrue(uri.contains("issuer=PDA") && uri.contains("algorithm=SHA1") && uri.contains("digits=6")
                && uri.contains("period=30"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM totp_credentials WHERE confirmed_at IS NULL"
                + " AND user_id = ?", Integer.class, admin.id));
        assertFalse(jdbc.queryForObject("SELECT secret_encrypted FROM totp_credentials WHERE user_id = ?",
                String.class, admin.id).contains(secret));

        // A wrong code does not switch two-factor on and opens no session; the ticket survives for another try.
        MockHttpServletResponse wrong = postJson("/api/v1/auth/admin/2fa/enable", "{\"code\":\"000000\"}", ticket)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("two_factor_code_invalid"))
                .andReturn().getResponse();
        assertNoSignInCookies(wrong);
        assertFalse(isTwoFactorOn(admin.id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, admin.id));

        clock.advance(Duration.ofSeconds(30));
        String right = code(secret);
        MockHttpServletResponse enabled = postJson("/api/v1/auth/admin/2fa/enable", "{\"code\":\"" + right + "\"}", ticket)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SIGNED_IN"))
                .andExpect(jsonPath("$.recoveryCodes.length()").value(10)).andReturn().getResponse();
        assertEquals("no-store", enabled.getHeader("Cache-Control"));
        JsonNode body = JSON.readTree(enabled.getContentAsString());
        Cookie access = enabled.getCookie("PDA_ACCESS");
        Cookie refresh = enabled.getCookie("PDA_REFRESH");
        assertNotNull(access);
        assertNotNull(refresh);
        assertEquals(0, enabled.getCookie(ENROLL).getMaxAge());
        assertTrue(isTwoFactorOn(admin.id));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?"
                + " AND admin_verified_at IS NOT NULL", Integer.class, admin.id));
        mvc.perform(get("/api/v1/admin/users").cookie(access)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.adminVerified").value(true));

        // The secret travels in the setup response only. It is in no other response, token or cookie.
        List<String> places = new ArrayList<>();
        places.add(mvc.perform(get("/api/v1/auth/me").cookie(access)).andReturn().getResponse().getContentAsString());
        places.add(mvc.perform(get("/api/v1/auth/2fa").cookie(access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true)).andReturn().getResponse().getContentAsString());
        places.add(mvc.perform(get("/api/v1/admin/users?search=" + admin.email).cookie(access)).andReturn().getResponse()
                .getContentAsString());
        places.add(mvc.perform(get("/api/v1/admin/users/" + admin.id).cookie(access)).andReturn().getResponse()
                .getContentAsString());
        places.add(mvc.perform(get("/api/v1/auth/sessions").cookie(access)).andReturn().getResponse().getContentAsString());
        places.add(enabled.getContentAsString().replaceAll("\"recoveryCodes\":\\[[^\\]]*\\]", ""));
        for (String token : new String[] {access.getValue(), refresh.getValue(), ticket.getValue()}) {
            places.add(token);
            places.add(new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8));
        }
        for (String place : places) {
            assertFalse(place.contains(secret), "the secret must not appear outside the setup response");
        }
        for (JsonNode recovery : body.get("recoveryCodes")) {
            assertTrue(recovery.asText().matches("[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}"));
        }

        // The ticket is used up.
        clock.advance(Duration.ofSeconds(30));
        postJson("/api/v1/auth/admin/2fa/enable", "{\"code\":\"" + code(secret) + "\"}", ticket)
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("two_factor_session_expired"));
        postJson("/api/v1/auth/admin/2fa/setup", null, ticket)
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("two_factor_session_expired"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM admin_auth_tickets WHERE user_id = ?"
                + " AND consumed_at IS NOT NULL", Integer.class, admin.id));

        // Audit lines carry the account id and the outcome, never an email, password, secret, code or token.
        // Only the application's own log lines (MockMvc echoes whole requests to the console, which is not the application).
        String logs = output.getAll().lines().filter(line -> line.matches(".*\\] c\\.p\\.\\S+ +: .*"))
                .collect(java.util.stream.Collectors.joining("\n"));
        assertTrue(logs.contains("Administrator password accepted. userId=" + admin.id));
        assertTrue(logs.contains("Administrator authenticator enrolled; verified session opened. userId=" + admin.id));
        for (String forbidden : new String[] {admin.email, PASSWORD, secret, access.getValue(),
                refresh.getValue(), ticket.getValue(), body.get("recoveryCodes").get(0).asText()}) {
            assertFalse(logs.contains(forbidden), "log output must not contain secrets");
        }
    }

    @Test
    void anEnrolmentTicketExpiresAfterTenMinutesAndANewerPasswordStepReplacesIt() throws Exception {
        Account admin = newAdmin();
        Cookie old = adminLogin(admin.email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getCookie(ENROLL);
        Cookie newer = adminLogin(admin.email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getCookie(ENROLL);
        assertNotNull(old);
        assertNotNull(newer);
        postJson("/api/v1/auth/admin/2fa/setup", null, old).andExpect(status().isUnauthorized());
        postJson("/api/v1/auth/admin/2fa/setup", null, newer).andExpect(status().isOk());

        clock.advance(Duration.ofMinutes(10).plusSeconds(1));
        postJson("/api/v1/auth/admin/2fa/setup", null, newer)
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("two_factor_session_expired"));
        postJson("/api/v1/auth/admin/2fa/enable", "{\"code\":\"000000\"}", newer).andExpect(status().isUnauthorized());
    }

    @Test
    void theServerSideRowDecidesNotJustTheSignature() throws Exception {
        Account admin = newAdmin();
        Cookie ticket = adminLogin(admin.email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse().getCookie(ENROLL);
        postJson("/api/v1/auth/admin/2fa/setup", null, ticket).andExpect(status().isOk());
        // The row expires (or is removed) while the signed cookie is still within its own lifetime.
        jdbc.update("UPDATE admin_auth_tickets SET expires_at = ? WHERE user_id = ?",
                java.sql.Timestamp.from(clock.instant().minusSeconds(1)), admin.id);
        postJson("/api/v1/auth/admin/2fa/setup", null, ticket).andExpect(status().isUnauthorized());
        jdbc.update("DELETE FROM admin_auth_tickets WHERE user_id = ?", admin.id);
        postJson("/api/v1/auth/admin/2fa/setup", null, ticket).andExpect(status().isUnauthorized());
    }

    // ---- later sign-ins: the authenticator step (tests 7, 8, 9) --------------------------------------------

    @Test
    void afterwardsThePasswordYieldsOnlyATicketAndTheRightCodeOpensTheSession() throws Exception {
        Account admin = newAdmin();
        enrol(admin);

        MockHttpServletResponse step1 = adminLogin(admin.email, PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED")).andReturn().getResponse();
        assertNoSignInCookies(step1);
        Cookie ticket = step1.getCookie(MFA);
        assertNotNull(ticket);
        assertTrue(ticket.isHttpOnly());
        assertEquals("/api/v1/auth/admin/login/2fa", ticket.getPath());
        assertEquals(300, ticket.getMaxAge());
        assertNull(step1.getCookie(ENROLL));
        assertNull(step1.getCookie("PDA_MFA"));

        // Password only: the admin API and the account endpoints stay closed; the ticket is not an access token.
        mvc.perform(get("/api/v1/admin/users").cookie(new Cookie("PDA_ACCESS", ticket.getValue())))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/admin/overview").cookie(ticket)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("PDA_ACCESS", ticket.getValue()))).andExpect(status().isUnauthorized());
        // It is not accepted by the regular second step, nor by the enrolment endpoints.
        postJson("/api/v1/auth/login/2fa", "{\"code\":\"000000\"}", new Cookie("PDA_MFA", ticket.getValue()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("two_factor_session_expired"));
        postJson("/api/v1/auth/admin/2fa/setup", null, new Cookie(ENROLL, ticket.getValue()))
                .andExpect(status().isUnauthorized());
        postJson("/api/v1/auth/admin/2fa/enable", "{\"code\":\"000000\"}", new Cookie(ENROLL, ticket.getValue()))
                .andExpect(status().isUnauthorized());

        // A wrong code: no session, an error, the ticket still stands.
        MockHttpServletResponse wrong = postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"000000\"}", ticket)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("two_factor_code_invalid"))
                .andReturn().getResponse();
        assertNoSignInCookies(wrong);

        clock.advance(Duration.ofSeconds(30));
        String secret = secretOf(admin);
        MockHttpServletResponse signedIn = postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(secret) + "\"}", ticket)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SIGNED_IN")).andReturn().getResponse();
        Cookie access = signedIn.getCookie("PDA_ACCESS");
        assertNotNull(access);
        assertNotNull(signedIn.getCookie("PDA_REFRESH"));
        assertEquals(0, signedIn.getCookie(MFA).getMaxAge());
        mvc.perform(get("/api/v1/admin/users").cookie(access)).andExpect(status().isOk());

        // Single use: the same ticket with another valid code is refused.
        clock.advance(Duration.ofSeconds(30));
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(secret) + "\"}", ticket)
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("two_factor_session_expired"));
    }

    @Test
    void aBackupCodeSignsAnAdministratorInOnceAndTheAuthenticatorCodeWorksOncePerStep() throws Exception {
        Account admin = newAdmin();
        Enrolment enrolled = enrol(admin);

        Cookie ticket = mfaTicket(admin);
        MockHttpServletResponse byBackup = postJson("/api/v1/auth/admin/login/2fa",
                "{\"code\":\"" + enrolled.backupCodes.get(0) + "\"}", ticket).andExpect(status().isOk()).andReturn().getResponse();
        assertNotNull(byBackup.getCookie("PDA_ACCESS"));
        Cookie again = mfaTicket(admin);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + enrolled.backupCodes.get(0) + "\"}", again)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("two_factor_code_invalid"));

        // The code that enrolled the authenticator cannot be replayed for the next sign-in within its step.
        Cookie sameStep = mfaTicket(admin);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + enrolled.firstCode + "\"}", sameStep)
                .andExpect(status().isBadRequest());
        clock.advance(Duration.ofSeconds(30));
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(enrolled.secret) + "\"}", sameStep)
                .andExpect(status().isOk());
    }

    @Test
    void fiveWrongCodesLockTheAdministratorSecondFactorAndTheTicketExpiresAfterFiveMinutes() throws Exception {
        Account admin = newAdmin();
        Enrolment enrolled = enrol(admin);
        clock.advance(Duration.ofSeconds(30));
        Cookie ticket = mfaTicket(admin);

        for (int attempt = 1; attempt <= 4; attempt++) {
            postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"000000\"}", ticket).andExpect(status().isBadRequest());
        }
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"000000\"}", ticket)
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("two_factor_locked"));
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(enrolled.secret) + "\"}", ticket)
                .andExpect(status().isTooManyRequests());

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));
        Cookie late = mfaTicket(admin);
        clock.advance(Duration.ofMinutes(5).plusSeconds(1));
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(enrolled.secret) + "\"}", late)
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("two_factor_session_expired"));
        Cookie fresh = mfaTicket(admin);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(enrolled.secret) + "\"}", fresh)
                .andExpect(status().isOk());
    }

    @Test
    void aNewerPasswordStepReplacesTheMfaTicketAndTheTicketsAreNotInterchangeable() throws Exception {
        Account admin = newAdmin();
        Enrolment enrolled = enrol(admin);
        Account other = newAdmin();

        Cookie first = mfaTicket(admin);
        Cookie second = mfaTicket(admin);
        clock.advance(Duration.ofSeconds(30));
        String code = code(enrolled.secret);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code + "\"}", first).andExpect(status().isUnauthorized());
        // Another administrator's enrolment ticket opens neither the sign-in step nor this one.
        Cookie otherEnrol = adminLogin(other.email, PASSWORD).andReturn().getResponse().getCookie(ENROLL);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code + "\"}", new Cookie(MFA, otherEnrol.getValue()))
                .andExpect(status().isUnauthorized());
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code + "\"}", second).andExpect(status().isOk());
    }

    // ---- the administrator API needs an administrator-verified session --------------------------------------

    @Test
    void theAdministratorApiNeedsAnAdministratorVerifiedSession() throws Exception {
        Account admin = newAdmin();
        Account user = newUser();
        String[] reads = {"/api/v1/admin/users", "/api/v1/admin/users/" + user.id, "/api/v1/admin/users/" + user.id + "/sessions",
                "/api/v1/admin/overview", "/api/v1/admin/projects", "/api/v1/admin/system/status", "/api/v1/admin/analytics"};
        String[] writes = {"/api/v1/admin/users/" + user.id + "/disable", "/api/v1/admin/users/" + user.id + "/enable",
                "/api/v1/admin/users/" + user.id + "/sessions/revoke-all"};

        Cookie[] member = regularSession(user);
        Cookie[] legacy = sessionWithoutTheMark(admin);
        for (String path : reads) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).cookie(member[0])).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").doesNotExist());
            mvc.perform(get(path).cookie(legacy[0])).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("admin_reauthentication_required"));
        }
        Cookie csrf = csrf();
        for (String path : writes) {
            mvc.perform(post(path).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isUnauthorized());
            mvc.perform(post(path).cookie(csrf, member[0]).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").doesNotExist());
            mvc.perform(post(path).cookie(csrf, legacy[0]).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("admin_reauthentication_required"));
        }
        assertEquals("ACTIVE", jdbc.queryForObject("SELECT account_status FROM users WHERE id = ?", String.class, user.id));

        // The old session still serves the account endpoints (it is a valid session), but is flagged as not verified.
        mvc.perform(get("/api/v1/auth/me").cookie(legacy[0])).andExpect(status().isOk())
                .andExpect(jsonPath("$.adminVerified").value(false));
        // A non-administrator can never carry the mark.
        mvc.perform(get("/api/v1/auth/me").cookie(member[0])).andExpect(status().isOk())
                .andExpect(jsonPath("$.adminVerified").value(false));

        // After the real sign-in the same account is in.
        Enrolment enrolled = enrol(admin);
        for (String path : reads) {
            mvc.perform(get(path).cookie(enrolled.access)).andExpect(status().isOk());
        }
        // The legacy session stays refused even after the account enrolled.
        mvc.perform(get("/api/v1/admin/users").cookie(legacy[0])).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("admin_reauthentication_required"));
    }

    @Test
    void refreshKeepsTheMarkAndAnOldSessionStaysUnmarkedAfterRefresh() throws Exception {
        Account admin = newAdmin();
        Account legacyAdmin = newAdmin();
        Enrolment enrolled = enrol(admin);
        Cookie[] legacy = sessionWithoutTheMark(legacyAdmin);

        clock.advance(Duration.ofMinutes(1));
        Cookie csrf = csrf();
        MockHttpServletResponse refreshed = mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, enrolled.refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isOk()).andReturn().getResponse();
        Cookie newAccess = refreshed.getCookie("PDA_ACCESS");
        assertNotNull(newAccess);
        assertFalse(newAccess.getValue().equals(enrolled.access.getValue()));
        mvc.perform(get("/api/v1/admin/users").cookie(newAccess)).andExpect(status().isOk());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?"
                + " AND admin_verified_at IS NOT NULL", Integer.class, admin.id));

        Cookie csrf2 = csrf();
        Cookie legacyAccess = mvc.perform(post("/api/v1/auth/refresh").cookie(csrf2, legacy[1])
                        .header("X-XSRF-TOKEN", csrf2.getValue())).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("PDA_ACCESS");
        mvc.perform(get("/api/v1/admin/users").cookie(legacyAccess)).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("admin_reauthentication_required"));
    }

    // ---- logout (test 12) ---------------------------------------------------------------------------------

    @Test
    void logoutEndsTheSessionAndClearsEveryTicketCookie() throws Exception {
        Account admin = newAdmin();
        Enrolment enrolled = enrol(admin);
        Cookie ticket = mfaTicket(admin);

        Cookie csrf = csrf();
        MockHttpServletResponse response = mvc.perform(post("/api/v1/auth/logout")
                        .cookie(csrf, enrolled.access, enrolled.refresh, ticket).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse();
        List<String> cleared = response.getHeaders(HttpHeaders.SET_COOKIE);
        for (String[] expected : new String[][] {{"PDA_ACCESS", "/api"}, {"PDA_REFRESH", "/api/v1/auth"}, {"PDA_SESSION", "/"},
                {"PDA_MFA", "/api/v1/auth/login"}, {MFA, "/api/v1/auth/admin/login/2fa"},
                {ENROLL, "/api/v1/auth/admin/2fa"}}) {
            assertTrue(cleared.stream().anyMatch(value -> value.startsWith(expected[0] + "=;")
                            && value.contains("Max-Age=0") && value.contains("Path=" + expected[1])),
                    expected[0] + " must be cleared on " + expected[1] + ": " + cleared);
        }
        mvc.perform(get("/api/v1/admin/users").cookie(enrolled.access)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").cookie(enrolled.access)).andExpect(status().isUnauthorized());
    }

    // ---- mandatory two-factor ------------------------------------------------------------------------------

    @Test
    void anAdministratorCannotSwitchTwoFactorOffButMayRenewTheBackupCodes() throws Exception {
        Account admin = newAdmin();
        Enrolment enrolled = enrol(admin);

        clock.advance(Duration.ofSeconds(30));
        postJson("/api/v1/auth/2fa/disable", "{\"password\":\"" + PASSWORD + "\",\"code\":\"" + code(enrolled.secret) + "\"}",
                enrolled.access).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("admin_two_factor_required"));
        assertTrue(isTwoFactorOn(admin.id));
        assertEquals(10, jdbc.queryForObject("SELECT count(*) FROM totp_recovery_codes WHERE user_id = ? AND used_at IS NULL",
                Integer.class, admin.id));

        JsonNode renewed = JSON.readTree(postJson("/api/v1/auth/2fa/recovery-codes",
                "{\"code\":\"" + code(enrolled.secret) + "\"}", enrolled.access).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertEquals(10, renewed.get("recoveryCodes").size());
        // The old codes are gone, a new one signs in.
        Cookie oldTicket = mfaTicket(admin);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + enrolled.backupCodes.get(1) + "\"}", oldTicket)
                .andExpect(status().isBadRequest());
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + renewed.get("recoveryCodes").get(0).asText() + "\"}", oldTicket)
                .andExpect(status().isOk());
    }

    // ---- the ENV administrator (test 4) -----------------------------------------------------------------

    @Test
    void theEnvAdministratorGoesStraightToEnrolmentWithoutAForcedPasswordChangeAndTheMechanismStays() throws Exception {
        assertFalse(jdbc.queryForObject("SELECT must_change_password FROM users WHERE email = ?", Boolean.class, ENV_ADMIN_EMAIL));

        login(ENV_ADMIN_EMAIL, ENV_ADMIN_PASSWORD).andExpect(status().isUnauthorized());
        Account env = new Account(jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, ENV_ADMIN_EMAIL),
                ENV_ADMIN_EMAIL, ENV_ADMIN_PASSWORD);
        Enrolment enrolled = enrol(env);

        mvc.perform(get("/api/v1/auth/me").cookie(enrolled.access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.mustChangePassword").value(false))
                .andExpect(jsonPath("$.globalRole").value("ADMIN"));
        mvc.perform(get("/api/v1/admin/users").cookie(enrolled.access)).andExpect(status().isOk());

        // The forced-change mechanism itself is intact for any account that carries the flag.
        jdbc.update("UPDATE users SET must_change_password = TRUE WHERE id = ?", env.id);
        try {
            mvc.perform(get("/api/v1/admin/users").cookie(enrolled.access)).andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("password_change_required"));
            mvc.perform(get("/api/v1/auth/me").cookie(enrolled.access)).andExpect(status().isOk());
        } finally {
            jdbc.update("UPDATE users SET must_change_password = FALSE WHERE id = ?", env.id);
        }
    }

    // ---- a missing or changed key never becomes a 500 ---------------------------------------------------

    @Test
    void anUnreadableSecretAnswers503OnBothSecondSteps() throws Exception {
        // A confirmed credential the current key cannot open (the key was changed).
        Account admin = newAdmin();
        plantUnreadableCredential(admin.id);
        Cookie ticket = adminLogin(admin.email, PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED")).andReturn().getResponse().getCookie(MFA);
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"123456\"}", ticket)
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("two_factor_unavailable"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, admin.id));

        Account user = newUser();
        plantUnreadableCredential(user.id);
        Cookie pending = login(user.email, PASSWORD).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED")).andReturn().getResponse().getCookie("PDA_MFA");
        postJson("/api/v1/auth/login/2fa", "{\"code\":\"123456\"}", pending)
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("two_factor_unavailable"));
    }

    // ---- the persistent audit trail ---------------------------------------------------------------------

    @Test
    void everySignInResultIsWrittenToTheAuditTrailWithAnActorOnlyWhenKnownAndNeverAnEmailOrCode() throws Exception {
        Integer unknownBefore = jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE actor_user_id IS NULL"
                + " AND action = 'ADMIN_SIGN_IN' AND outcome = 'FAILURE' AND target_type = 'SYSTEM'", Integer.class);
        Account admin = newAdmin();

        // A wrong password: the account is not known to the trail (the answer must not reveal it either).
        adminLogin(admin.email, "Wrong-Pass1").andExpect(status().isUnauthorized());
        assertEquals(unknownBefore + 1, jdbc.queryForObject("SELECT count(*) FROM admin_audit_events"
                + " WHERE actor_user_id IS NULL AND action = 'ADMIN_SIGN_IN' AND outcome = 'FAILURE'"
                + " AND target_type = 'SYSTEM'", Integer.class));
        assertTrue(auditOutcomes(admin.id).isEmpty());

        // The first right code of the enrolment opens the session: SUCCESS, the account is actor and target.
        Enrolment enrolled = enrol(admin);
        assertEquals(java.util.Map.of("SUCCESS", 1), auditOutcomes(admin.id));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE actor_user_id = ?"
                + " AND target_type = 'USER' AND target_id = ?", Integer.class, admin.id, admin.id));

        // Four wrong codes are FAILURE, the fifth locks the factor (DENIED), and a right code while locked is DENIED too.
        clock.advance(Duration.ofSeconds(30));
        Cookie ticket = mfaTicket(admin);
        for (int attempt = 1; attempt <= 4; attempt++) {
            postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"000000\"}", ticket).andExpect(status().isBadRequest());
        }
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"000000\"}", ticket).andExpect(status().isTooManyRequests());
        postJson("/api/v1/auth/admin/login/2fa", "{\"code\":\"" + code(enrolled.secret) + "\"}", ticket)
                .andExpect(status().isTooManyRequests());
        assertEquals(java.util.Map.of("SUCCESS", 1, "FAILURE", 4, "DENIED", 2), auditOutcomes(admin.id));

        // Nothing but ids, codes and times: no column could hold free text, and no row mentions an address.
        assertEquals(java.util.List.of("action", "actor_user_id", "id", "occurred_at", "outcome", "target_id", "target_type"),
                jdbc.queryForList("SELECT column_name FROM information_schema.columns WHERE table_name = 'admin_audit_events'"
                        + " ORDER BY column_name", String.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM admin_audit_events WHERE action || target_type || outcome"
                + " || coalesce(actor_user_id::text, '') || coalesce(target_id::text, '') LIKE '%@%'", Integer.class));
    }

    private java.util.Map<String, Integer> auditOutcomes(UUID actor) {
        java.util.Map<String, Integer> outcomes = new java.util.TreeMap<>();
        jdbc.query("SELECT outcome, count(*) AS total FROM admin_audit_events WHERE actor_user_id = ?"
                + " AND action = 'ADMIN_SIGN_IN' GROUP BY outcome", rs -> {
            outcomes.put(rs.getString("outcome"), rs.getInt("total"));
        }, actor);
        return outcomes;
    }

    // ---- helpers ---------------------------------------------------------------------------------------

    private record Account(UUID id, String email, String password) {}

    /** An account together with its authenticator secret once one was set up. */
    private static final class Enrolment {
        final String secret;
        final String firstCode;
        final List<String> backupCodes;
        final Cookie access;
        final Cookie refresh;

        Enrolment(String secret, String firstCode, List<String> backupCodes, Cookie access, Cookie refresh) {
            this.secret = secret;
            this.firstCode = firstCode;
            this.backupCodes = backupCodes;
            this.access = access;
            this.refresh = refresh;
        }
    }

    private Account newAdmin() {
        Account account = newUser();
        jdbc.update("UPDATE users SET global_role = 'ADMIN' WHERE id = ?", account.id);
        return account;
    }

    private Account newUser() {
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), PASSWORD, encoder));
        return new Account(user.getId(), user.getEmail(), PASSWORD);
    }

    /** The full first sign-in of a not yet enrolled administrator: password, setup, first code. */
    private Enrolment enrol(Account admin) throws Exception {
        Cookie ticket = adminLogin(admin.email, admin.password).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_ENROLLMENT_REQUIRED")).andReturn().getResponse().getCookie(ENROLL);
        assertNotNull(ticket);
        String secret = JSON.readTree(postJson("/api/v1/auth/admin/2fa/setup", null, ticket).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("secret").asText();
        clock.advance(Duration.ofSeconds(30));
        String firstCode = code(secret);
        MockHttpServletResponse response = postJson("/api/v1/auth/admin/2fa/enable", "{\"code\":\"" + firstCode + "\"}", ticket)
                .andExpect(status().isOk()).andReturn().getResponse();
        List<String> backup = new ArrayList<>();
        JSON.readTree(response.getContentAsString()).get("recoveryCodes").forEach(node -> backup.add(node.asText()));
        secrets.put(admin.id, secret);
        return new Enrolment(secret, firstCode, backup, response.getCookie("PDA_ACCESS"), response.getCookie("PDA_REFRESH"));
    }

    private final java.util.Map<UUID, String> secrets = new java.util.concurrent.ConcurrentHashMap<>();

    private String secretOf(Account account) {
        return secrets.get(account.id);
    }

    /** Switches two-factor on for a regular user straight through the service layer (the secret is returned). */
    private void enableTwoFactor(Account account) throws Exception {
        Cookie[] session = regularSession(account);
        String secret = JSON.readTree(postJson("/api/v1/auth/2fa/setup", null, session[0]).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get("secret").asText();
        clock.advance(Duration.ofSeconds(30));
        postJson("/api/v1/auth/2fa/enable", "{\"code\":\"" + code(secret) + "\"}", session[0]).andExpect(status().isOk());
        secrets.put(account.id, secret);
    }

    private Cookie mfaTicket(Account admin) throws Exception {
        Cookie ticket = adminLogin(admin.email, admin.password).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED")).andReturn().getResponse().getCookie(MFA);
        assertNotNull(ticket);
        return ticket;
    }

    private void plantUnreadableCredential(UUID userId) {
        jdbc.update("INSERT INTO totp_credentials (id, user_id, secret_encrypted, confirmed_at, last_used_step,"
                        + " failed_attempts, created_at, version) VALUES (?, ?, ?, now(), 0, 0, now(), 0)",
                UUID.randomUUID(), userId, Base64.getEncoder().encodeToString(new byte[48]));
    }

    /** A real regular sign-in of a user without two-factor: {access, refresh}. */
    private Cookie[] regularSession(Account user) throws Exception {
        MockHttpServletResponse response = login(user.email, user.password).andExpect(status().isOk()).andReturn().getResponse();
        return new Cookie[] {response.getCookie("PDA_ACCESS"), response.getCookie("PDA_REFRESH")};
    }

    /** A session of an administrator that was not opened by the administrator sign-in (as every session was before). */
    private Cookie[] sessionWithoutTheMark(Account admin) {
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(admin.id);
        UUID sessionId = sessions.open(admin.id, refresh.value(), refresh.expiresAt(), "legacy");
        JwtTokens.IssuedToken access = tokens.issueAccess(admin.id, sessionId);
        return new Cookie[] {new Cookie("PDA_ACCESS", access.value()), new Cookie("PDA_REFRESH", refresh.value())};
    }

    private boolean isTwoFactorOn(UUID userId) {
        return jdbc.queryForObject("SELECT count(*) FROM totp_credentials WHERE user_id = ? AND confirmed_at IS NOT NULL",
                Integer.class, userId) == 1;
    }

    /** The problem body names the request path (instance); everything else must be identical. */
    private static String withoutInstance(String body) {
        return body.replaceAll("\"instance\":\"[^\"]*\",?", "");
    }

    private static void assertNoSignInCookies(MockHttpServletResponse response) {
        assertNull(response.getCookie("PDA_ACCESS"));
        assertNull(response.getCookie("PDA_REFRESH"));
        assertNull(response.getCookie("PDA_SESSION"));
    }

    private ResultActions login(String email, String password) throws Exception {
        return postJson("/api/v1/auth/login", "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private ResultActions adminLogin(String email, String password) throws Exception {
        return postJson("/api/v1/auth/admin/login", "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private ResultActions postJson(String path, String body, Cookie... cookies) throws Exception {
        Cookie csrf = csrf();
        List<Cookie> all = new ArrayList<>(List.of(csrf));
        all.addAll(List.of(cookies));
        var request = post(path).cookie(all.toArray(Cookie[]::new)).header("X-XSRF-TOKEN", csrf.getValue());
        if (body != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request);
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    // ---- an RFC 6238 implementation of the test's own (the phone) ---------------------------------------

    private String code(String base32Secret) {
        return code(base32Secret, Math.floorDiv(clock.instant().getEpochSecond(), 30));
    }

    private static String code(String base32Secret, long step) {
        try {
            byte[] key = decodeBase32(base32Secret);
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(key, "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = (hash[offset] & 0x7f) << 24 | (hash[offset + 1] & 0xff) << 16
                    | (hash[offset + 2] & 0xff) << 8 | (hash[offset + 3] & 0xff);
            return String.format("%06d", binary % 1_000_000);
        } catch (java.security.GeneralSecurityException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static byte[] decodeBase32(String text) {
        String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (char c : text.toCharArray()) {
            buffer = buffer << 5 | alphabet.indexOf(c);
            bits += 5;
            if (bits >= 8) {
                out.write(buffer >> (bits - 8) & 0xff);
                bits -= 8;
            }
        }
        return out.toByteArray();
    }

    private static byte[] randomKey() {
        byte[] key = new byte[32];
        new SecureRandom().nextBytes(key);
        return key;
    }
}
