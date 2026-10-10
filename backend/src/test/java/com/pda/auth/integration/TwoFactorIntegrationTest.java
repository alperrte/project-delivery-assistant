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
import com.pda.auth.application.service.OAuthLoginService;
import com.pda.auth.application.service.TotpService;
import com.pda.user.OAuthProvider;
import jakarta.servlet.http.Cookie;
import java.nio.ByteBuffer;
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
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
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

/**
 * Authenticator-app two-factor sign-in through the whole stack. The application runs on a clock the test moves, and the
 * codes are computed here with an independent RFC 6238 implementation (not the production class).
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import({CapturingMailConfiguration.class, SessionExpiryIntegrationTest.MovableClockConfiguration.class})
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TwoFactorIntegrationTest {

    private static final byte[] JWT_KEY = randomKey();
    private static final byte[] HMAC_KEY = randomKey();
    private static final byte[] TOTP_KEY = randomKey();

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("MAIL_ENABLED", () -> "true");
        registry.add("EMAIL_VERIFICATION_HMAC_KEY", () -> Base64.getEncoder().encodeToString(HMAC_KEY));
        registry.add("TOTP_ENCRYPTION_KEY", () -> Base64.getEncoder().encodeToString(TOTP_KEY));
        registry.add("auth.rate-limit.sensitive-max-requests", () -> "1000");
        registry.add("auth.rate-limit.login-max-requests", () -> "1000");
        registry.add("auth.rate-limit.refresh-max-requests", () -> "1000");
    }

    private static final String PASSWORD = "Strong-Pass1";
    private static final ObjectMapper JSON = new ObjectMapper();

    @Autowired MockMvc mvc;
    @Autowired SessionExpiryIntegrationTest.MovableClock clock;
    @Autowired CapturingMailConfiguration.CapturingMailPort mail;
    @Autowired JdbcTemplate jdbc;
    @Autowired TotpService totp;
    @Autowired OAuthLoginService oauth;

    private String email;

    @BeforeEach
    void newUser() throws Exception {
        // A step boundary keeps "the next code" arithmetic simple.
        clock.set(Instant.ofEpochSecond(Instant.now().getEpochSecond() / 30 * 30 + 1));
        email = UUID.randomUUID() + "@example.test";
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"nickname\":\"u"
                                + UUID.randomUUID().toString().replace("-", "").substring(0, 20)
                                + "\",\"password\":\"" + PASSWORD + "\",\"confirmPassword\":\"" + PASSWORD
                                + "\",\"locale\":\"tr\"}"))
                .andExpect(status().isOk());
        Cookie csrf2 = csrf();
        mvc.perform(post("/api/v1/auth/register/verify").cookie(csrf2).header("X-XSRF-TOKEN", csrf2.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"code\":\"" + mail.lastSecretFor(email) + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void settingItUpNeedsAWorkingAuthenticatorAndTheSecretIsNotStoredInThePlain() throws Exception {
        Cookie[] session = login();
        statusOf(session[0]).andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.passwordRequired").value(true));

        JsonNode setup = JSON.readTree(post2fa("/api/v1/auth/2fa/setup", session[0], null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String secret = setup.get("secret").asText();
        assertTrue(setup.get("otpauthUri").asText().startsWith("otpauth://totp/PDA:"));
        assertTrue(setup.get("otpauthUri").asText().contains("secret=" + secret));

        // Until the first code is proven nothing changes for the sign-in.
        statusOf(session[0]).andExpect(jsonPath("$.enabled").value(false));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM totp_credentials WHERE confirmed_at IS NULL"
                + " AND user_id = (SELECT id FROM users WHERE email = ?)", Integer.class, email));
        String stored = jdbc.queryForObject("SELECT secret_encrypted FROM totp_credentials WHERE user_id ="
                + " (SELECT id FROM users WHERE email = ?)", String.class, email);
        assertFalse(stored.contains(secret));

        post2fa("/api/v1/auth/2fa/enable", session[0], "{\"code\":\"000000\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("two_factor_code_invalid"));
        statusOf(session[0]).andExpect(jsonPath("$.enabled").value(false));

        enable(session[0], secret);
        statusOf(session[0]).andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.recoveryCodesLeft").value(10));
        post2fa("/api/v1/auth/2fa/setup", session[0], null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("two_factor_already_enabled"));
    }

    @Test
    void afterwardsThePasswordAloneOpensNoSessionAndTheCodeDoes() throws Exception {
        String secret = switchOn();

        var response = mvc.perform(withCsrf(post("/api/v1/auth/login"), loginBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED"))
                .andReturn().getResponse();
        assertNull(response.getCookie("PDA_ACCESS"));
        assertNull(response.getCookie("PDA_REFRESH"));
        Cookie pending = response.getCookie("PDA_MFA");
        assertNotNull(pending);
        assertTrue(pending.isHttpOnly());
        assertEquals("/api/v1/auth/login", pending.getPath());

        // The proof of the first factor opens nothing by itself, and it is not an access token.
        me(pending).andExpect(status().isUnauthorized());
        me(new Cookie("PDA_ACCESS", pending.getValue())).andExpect(status().isUnauthorized());

        clock.advance(Duration.ofSeconds(30));
        var signedIn = secondStep(pending, codeAt(secret)).andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = signedIn.getCookie("PDA_ACCESS");
        assertNotNull(access);
        assertNotNull(signedIn.getCookie("PDA_REFRESH"));
        assertEquals(0, signedIn.getCookie("PDA_MFA").getMaxAge());
        me(access).andExpect(status().isOk());
    }

    @Test
    void aWrongPasswordNeverGetsAsFarAsTheSecondStep() throws Exception {
        switchOn();
        var response = mvc.perform(withCsrf(post("/api/v1/auth/login"),
                        "{\"email\":\"" + email + "\",\"password\":\"Wrong-Pass1\"}"))
                .andExpect(status().isUnauthorized()).andReturn().getResponse();
        assertNull(response.getCookie("PDA_MFA"));
    }

    @Test
    void anAuthenticatorCodeWorksOnceEvenInsideItsThirtySeconds() throws Exception {
        String secret = switchOn();
        clock.advance(Duration.ofSeconds(30));
        String code = codeAt(secret);

        secondStep(pendingCookie(), code).andExpect(status().isOk());
        // A shoulder-surfer replays the same code a moment later.
        secondStep(pendingCookie(), code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("two_factor_code_invalid"));
        // The next code is fine again.
        clock.advance(Duration.ofSeconds(30));
        secondStep(pendingCookie(), codeAt(secret)).andExpect(status().isOk());
    }

    @Test
    void theCodeOfTheNeighbouringStepIsToleratedButNotOlderOnes() throws Exception {
        String secret = switchOn();
        clock.advance(Duration.ofSeconds(60));
        String slightlyOld = code(secret, step() - 1);
        String tooOld = code(secret, step() - 2);

        secondStep(pendingCookie(), tooOld).andExpect(status().isBadRequest());
        secondStep(pendingCookie(), slightlyOld).andExpect(status().isOk());
    }

    @Test
    void fiveWrongCodesLockTheSecondFactorForFifteenMinutes() throws Exception {
        String secret = switchOn();
        clock.advance(Duration.ofSeconds(30));
        Cookie pending = pendingCookie();

        for (int attempt = 1; attempt <= 4; attempt++) {
            secondStep(pending, "000000").andExpect(status().isBadRequest());
        }
        secondStep(pending, "000000").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("two_factor_locked"));
        // Even the right code is refused while locked.
        secondStep(pending, codeAt(secret)).andExpect(status().isTooManyRequests());

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));
        Cookie fresh = pendingCookie();
        secondStep(fresh, codeAt(secret)).andExpect(status().isOk());
    }

    @Test
    void theStepAfterThePasswordExpiresAfterFiveMinutes() throws Exception {
        String secret = switchOn();
        Cookie pending = pendingCookie();

        clock.advance(Duration.ofMinutes(5).plusSeconds(1));
        secondStep(pending, codeAt(secret)).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("two_factor_session_expired"));
    }

    @Test
    void theSecondStepWithoutTheFirstIsRefused() throws Exception {
        String secret = switchOn();
        mvc.perform(withCsrf(post("/api/v1/auth/login/2fa"), "{\"code\":\"" + codeAt(secret) + "\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("two_factor_session_expired"));
    }

    @Test
    void aBackupCodeWorksExactlyOnce() throws Exception {
        Cookie[] session = login();
        String secret = JSON.readTree(post2fa("/api/v1/auth/2fa/setup", session[0], null)
                .andReturn().getResponse().getContentAsString()).get("secret").asText();
        List<String> backup = enable(session[0], secret);
        assertEquals(10, backup.size());
        assertTrue(backup.get(0).matches("[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}"), backup.get(0));
        String stored = jdbc.queryForObject("SELECT string_agg(code_hash, ',') FROM totp_recovery_codes WHERE user_id ="
                + " (SELECT id FROM users WHERE email = ?)", String.class, email);
        assertFalse(stored.contains(backup.get(0).replace("-", "")));

        secondStep(pendingCookie(), backup.get(0)).andExpect(status().isOk());
        secondStep(pendingCookie(), backup.get(0)).andExpect(status().isBadRequest());
        // Typed in lower case without the dash, another one still works.
        secondStep(pendingCookie(), backup.get(1).replace("-", "").toLowerCase()).andExpect(status().isOk());

        Cookie access = secondStep(pendingCookie(), backup.get(2)).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("PDA_ACCESS");
        assertNotNull(access);
        statusOf(access).andExpect(jsonPath("$.recoveryCodesLeft").value(7));
    }

    @Test
    void regeneratingBackupCodesKillsTheOldOnesAndNeedsAnAuthenticatorCode() throws Exception {
        Cookie[] session = login();
        String secret = JSON.readTree(post2fa("/api/v1/auth/2fa/setup", session[0], null)
                .andReturn().getResponse().getContentAsString()).get("secret").asText();
        List<String> old = enable(session[0], secret);

        // A backup code cannot mint new backup codes.
        post2fa("/api/v1/auth/2fa/recovery-codes", session[0], "{\"code\":\"" + old.get(0) + "\"}")
                .andExpect(status().isBadRequest());

        clock.advance(Duration.ofSeconds(30));
        JsonNode renewed = JSON.readTree(post2fa("/api/v1/auth/2fa/recovery-codes", session[0],
                "{\"code\":\"" + codeAt(secret) + "\"}").andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertEquals(10, renewed.get("recoveryCodes").size());

        secondStep(pendingCookie(), old.get(3)).andExpect(status().isBadRequest());
        secondStep(pendingCookie(), renewed.get("recoveryCodes").get(0).asText()).andExpect(status().isOk());
    }

    @Test
    void switchingItOffNeedsThePasswordAndACurrentCode() throws Exception {
        Cookie[] session = login();
        String secret = JSON.readTree(post2fa("/api/v1/auth/2fa/setup", session[0], null)
                .andReturn().getResponse().getContentAsString()).get("secret").asText();
        enable(session[0], secret);
        clock.advance(Duration.ofSeconds(30));

        post2fa("/api/v1/auth/2fa/disable", session[0], "{\"password\":\"Wrong-Pass1\",\"code\":\"" + codeAt(secret) + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("current_password_incorrect"));
        post2fa("/api/v1/auth/2fa/disable", session[0], "{\"code\":\"" + codeAt(secret) + "\"}")
                .andExpect(status().isBadRequest());
        post2fa("/api/v1/auth/2fa/disable", session[0], "{\"password\":\"" + PASSWORD + "\",\"code\":\"000000\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("two_factor_code_invalid"));
        statusOf(session[0]).andExpect(jsonPath("$.enabled").value(true));

        post2fa("/api/v1/auth/2fa/disable", session[0], "{\"password\":\"" + PASSWORD + "\",\"code\":\"" + codeAt(secret) + "\"}")
                .andExpect(status().isOk());
        statusOf(session[0]).andExpect(jsonPath("$.enabled").value(false)).andExpect(jsonPath("$.recoveryCodesLeft").value(0));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM totp_credentials WHERE user_id ="
                + " (SELECT id FROM users WHERE email = ?)", Integer.class, email));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM totp_recovery_codes WHERE user_id ="
                + " (SELECT id FROM users WHERE email = ?)", Integer.class, email));
        // Back to a plain password sign-in.
        login();
    }

    @Test
    void theSettingsEndpointsNeedASession() throws Exception {
        mvc.perform(get("/api/v1/auth/2fa")).andExpect(status().isUnauthorized());
        mvc.perform(withCsrf(post("/api/v1/auth/2fa/setup"), null)).andExpect(status().isUnauthorized());
        mvc.perform(withCsrf(post("/api/v1/auth/2fa/enable"), "{\"code\":\"123456\"}")).andExpect(status().isUnauthorized());
        mvc.perform(withCsrf(post("/api/v1/auth/2fa/disable"), "{\"code\":\"123456\"}")).andExpect(status().isUnauthorized());
        mvc.perform(withCsrf(post("/api/v1/auth/2fa/recovery-codes"), "{\"code\":\"123456\"}")).andExpect(status().isUnauthorized());
    }

    @Test
    void aProviderSignInOwesTheSecondFactorToo() {
        String subject = "g-" + UUID.randomUUID();
        String providerEmail = subject + "@example.test";
        var profile = new OAuthLoginService.Profile(OAuthProvider.GOOGLE, subject, providerEmail, true, "Ada");

        assertFalse(oauth.login(profile, null).needsSecondFactor());
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, providerEmail);
        String secret = totp.beginSetup(userId, providerEmail).orElseThrow().secret();
        clock.advance(Duration.ofSeconds(30));
        assertEquals(TotpService.Result.OK, totp.enable(userId, codeAt(secret)).result());

        var again = oauth.login(profile, null);
        assertTrue(again.needsSecondFactor());
        assertNull(again.tokens());
        assertEquals(userId, again.secondFactorUserId());
    }

    // ---- helpers ----------------------------------------------------------------------------------------

    /** Signs up state: two-factor on for the test user. Returns the shared secret (base32). */
    private String switchOn() throws Exception {
        Cookie[] session = login();
        String secret = JSON.readTree(post2fa("/api/v1/auth/2fa/setup", session[0], null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("secret").asText();
        enable(session[0], secret);
        return secret;
    }

    private List<String> enable(Cookie access, String secret) throws Exception {
        clock.advance(Duration.ofSeconds(30));
        JsonNode body = JSON.readTree(post2fa("/api/v1/auth/2fa/enable", access, "{\"code\":\"" + codeAt(secret) + "\"}")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<String> codes = new ArrayList<>();
        body.get("recoveryCodes").forEach(node -> codes.add(node.asText()));
        return codes;
    }

    /** Password sign-in of an account without two-factor: {access, refresh}. */
    private Cookie[] login() throws Exception {
        var response = mvc.perform(withCsrf(post("/api/v1/auth/login"), loginBody()))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = response.getCookie("PDA_ACCESS");
        Cookie refresh = response.getCookie("PDA_REFRESH");
        assertNotNull(access);
        assertNotNull(refresh);
        return new Cookie[] {access, refresh};
    }

    /** Password sign-in of an account with two-factor: the PDA_MFA cookie. */
    private Cookie pendingCookie() throws Exception {
        Cookie pending = mvc.perform(withCsrf(post("/api/v1/auth/login"), loginBody()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED"))
                .andReturn().getResponse().getCookie("PDA_MFA");
        assertNotNull(pending);
        return pending;
    }

    private ResultActions secondStep(Cookie pending, String code) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/login/2fa").cookie(csrf, pending).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"" + code + "\"}"));
    }

    private ResultActions post2fa(String path, Cookie access, String body) throws Exception {
        Cookie csrf = csrf();
        var request = post(path).cookie(csrf, access).header("X-XSRF-TOKEN", csrf.getValue());
        if (body != null) {
            request = request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request);
    }

    private ResultActions statusOf(Cookie access) throws Exception {
        return mvc.perform(get("/api/v1/auth/2fa").cookie(access)).andExpect(status().isOk());
    }

    private ResultActions me(Cookie access) throws Exception {
        return mvc.perform(get("/api/v1/auth/me").cookie(access));
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder withCsrf(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request, String body)
            throws Exception {
        Cookie csrf = csrf();
        var builder = request.cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
        return body == null ? builder : builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private String loginBody() {
        return "{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}";
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    // ---- an RFC 6238 implementation of the test's own (the phone) ---------------------------------------

    private long step() {
        return Math.floorDiv(clock.instant().getEpochSecond(), 30);
    }

    private String codeAt(String base32Secret) {
        return code(base32Secret, step());
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
