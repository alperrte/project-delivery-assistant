package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import com.pda.auth.application.service.OAuthLoginService;
import com.pda.auth.application.service.TotpService;
import com.pda.user.OAuthProvider;
import jakarta.servlet.http.Cookie;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Account deletion through the whole stack: the mailed link, the proof on the public page, the ownership block, the
 * anonymisation and the aftermath (no sign-in, the address is free again). The clock is the test's own.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import({CapturingMailConfiguration.class, SessionExpiryIntegrationTest.MovableClockConfiguration.class})
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AccountDeletionIntegrationTest {

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

    @Autowired MockMvc mvc;
    @Autowired SessionExpiryIntegrationTest.MovableClock clock;
    @Autowired CapturingMailConfiguration.CapturingMailPort mail;
    @Autowired JdbcTemplate jdbc;
    @Autowired TotpService totp;
    @Autowired OAuthLoginService oauth;

    private String email;
    private Cookie access;

    @BeforeEach
    void newUser() throws Exception {
        clock.set(Instant.ofEpochSecond(Instant.now().getEpochSecond() / 30 * 30 + 1));
        mail.clear();
        email = registerAndVerify();
        access = login(email);
    }

    @Test
    void theRequestMailsALinkInTheSiteLanguageAndDeletesNothingYet() throws Exception {
        requestDeletion("de").andExpect(status().isAccepted());

        String link = mail.lastSecretFor(email);
        assertTrue(link.startsWith("http://localhost:3000/de/konto-loeschen?token="), link);
        assertEquals("ACCOUNT_DELETION", mail.all().get(mail.all().size() - 1).kind());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND account_status = 'ACTIVE'",
                Integer.class, email));
        // Only the hash of the token is stored.
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM account_deletion_requests WHERE token_hash = ?",
                Integer.class, tokenOf(link)));
        requestDeletion("tr").andExpect(status().isAccepted());
        assertEquals(1, deletionMails(email), "a second request inside the cooldown sends no second mail");
    }

    @Test
    void theLinkPerLanguageUsesTheLocalisedPage() throws Exception {
        requestDeletion("tr").andExpect(status().isAccepted());
        assertTrue(mail.lastSecretFor(email).startsWith("http://localhost:3000/tr/hesap-sil?token="));

        clock.advance(Duration.ofSeconds(61));
        requestDeletion("en").andExpect(status().isAccepted());
        assertTrue(mail.lastSecretFor(email).startsWith("http://localhost:3000/en/delete-account?token="));
    }

    @Test
    void theRequestNeedsASession() throws Exception {
        mvc.perform(withCsrf(post("/api/v1/auth/account/deletion/request"), "{\"locale\":\"tr\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theRightEmailAndPasswordDeleteTheAccountForGood() throws Exception {
        requestDeletion("tr").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(email));
        UUID id = idOf(email);
        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isOk());

        var response = confirm(token, email, PASSWORD, null).andExpect(status().isNoContent())
                .andReturn().getResponse();
        assertNotNull(response.getCookie("PDA_ACCESS"));
        assertEquals(0, response.getCookie("PDA_ACCESS").getMaxAge());

        assertEquals("DELETED", jdbc.queryForObject("SELECT account_status FROM users WHERE id = ?", String.class, id));
        assertTrue(jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, id).endsWith("@deleted.invalid"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ? AND password_hash IS NULL"
                + " AND first_name IS NULL AND last_name IS NULL", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_preferences WHERE user_id = ?", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM account_deletion_requests WHERE user_id = ?"
                + " AND consumed_at IS NULL", Integer.class, id));

        // The old session is gone, nobody can sign in, and the address is free for a new account.
        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isUnauthorized());
        mvc.perform(withCsrf(post("/api/v1/auth/login"), loginBody(email, PASSWORD))).andExpect(status().isUnauthorized());
        assertNotNull(registerAndVerify(email));
        assertNotNull(login(email));
    }

    @Test
    void theLinkWorksExactlyOnce() throws Exception {
        requestDeletion("tr").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(email));

        confirm(token, email, PASSWORD, null).andExpect(status().isNoContent());
        confirm(token, email, PASSWORD, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_link_invalid"));
    }

    @Test
    void theLinkDiesAfterFifteenMinutes() throws Exception {
        requestDeletion("tr").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(email));

        clock.advance(Duration.ofMinutes(15).plusSeconds(1));
        confirm(token, email, PASSWORD, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_link_expired"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND account_status = 'ACTIVE'",
                Integer.class, email));
    }

    @Test
    void aWrongPasswordOrEmailGivesOneAnswerAndFiveWrongOnesCancelTheLink() throws Exception {
        requestDeletion("tr").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(email));

        confirm(token, email, "Wrong-Pass1", null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_credentials_invalid"));
        confirm(token, "someone-else@example.test", PASSWORD, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_credentials_invalid"));
        confirm(token, email, "Wrong-Pass2", null).andExpect(status().isBadRequest());
        confirm(token, email, "Wrong-Pass3", null).andExpect(status().isBadRequest());
        confirm(token, email, "Wrong-Pass4", null).andExpect(status().isBadRequest());

        // The right answer comes too late: the link is dead.
        confirm(token, email, PASSWORD, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_link_invalid"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND account_status = 'ACTIVE'",
                Integer.class, email));
    }

    @Test
    void aMadeUpLinkDeletesNothing() throws Exception {
        confirm("not-a-real-token", email, PASSWORD, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_link_invalid"));
    }

    @Test
    void someoneElsesLinkCannotDeleteYourAccount() throws Exception {
        String other = registerAndVerify();
        Cookie otherAccess = login(other);
        requestDeletion(otherAccess, "tr").andExpect(status().isAccepted());
        String othersToken = tokenOf(mail.lastSecretFor(other));

        // My email and password with their link: the link belongs to the other account.
        confirm(othersToken, email, PASSWORD, null).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("deletion_credentials_invalid"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND account_status = 'ACTIVE'",
                Integer.class, email));
    }

    @Test
    void ownedProjectsBlockDeletionAtBothSteps() throws Exception {
        createProject(access, "Silme Engeli " + UUID.randomUUID().toString().substring(0, 8));

        requestDeletion("tr").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("owns_resources"))
                .andExpect(jsonPath("$.owned[0].kind").value("PROJECT"));
        assertEquals(0, deletionMails(email));

        // A link asked for before the project existed does not get around it.
        String free = registerAndVerify();
        Cookie freeAccess = login(free);
        requestDeletion(freeAccess, "tr").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(free));
        createProject(freeAccess, "Sonradan " + UUID.randomUUID().toString().substring(0, 8));
        confirm(token, free, PASSWORD, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("owns_resources"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email = ? AND account_status = 'ACTIVE'",
                Integer.class, free));
    }

    @Test
    void anAdministratorAccountCannotBeDeletedByItsOwner() throws Exception {
        jdbc.update("UPDATE users SET global_role = 'ADMIN' WHERE email = ?", email);
        Cookie adminAccess = login(email);

        requestDeletion(adminAccess, "tr").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("administrator_cannot_delete"));
    }

    @Test
    void anAccountWithoutAPasswordNeedsOnlyTheEmail() throws Exception {
        String subject = "g-" + UUID.randomUUID();
        String providerEmail = subject + "@example.test";
        oauth.login(new OAuthLoginService.Profile(OAuthProvider.GOOGLE, subject, providerEmail, true, "Ada"), null);
        UUID id = idOf(providerEmail);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_oauth_identities WHERE user_id = ?",
                Integer.class, id));
        Cookie providerAccess = oauthAccess(subject, providerEmail);

        requestDeletion(providerAccess, "en").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(providerEmail));
        confirm(token, "wrong@example.test", null, null).andExpect(status().isBadRequest());
        confirm(token, providerEmail, null, null).andExpect(status().isNoContent());

        assertEquals("DELETED", jdbc.queryForObject("SELECT account_status FROM users WHERE id = ?", String.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_oauth_identities WHERE user_id = ?",
                Integer.class, id));
    }

    @Test
    void withTwoFactorOnTheAuthenticatorCodeIsNeededToo() throws Exception {
        UUID id = idOf(email);
        String secret = totp.beginSetup(id, email).orElseThrow().secret();
        clock.advance(Duration.ofSeconds(30));
        assertEquals(TotpService.Result.OK, totp.enable(id, code(secret, step())).result());
        requestDeletion("tr").andExpect(status().isAccepted());
        String token = tokenOf(mail.lastSecretFor(email));

        confirm(token, email, PASSWORD, null).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("two_factor_required"));
        // A missing code is no wrong attempt, a wrong one is.
        confirm(token, email, PASSWORD, "000000").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("two_factor_code_invalid"));
        // The code that switched it on is spent; the next one is fine.
        clock.advance(Duration.ofSeconds(30));
        confirm(token, email, PASSWORD, code(secret, step())).andExpect(status().isNoContent());

        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM totp_credentials WHERE user_id = ?", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM totp_recovery_codes WHERE user_id = ?", Integer.class, id));
    }

    @Test
    void whenMailIsDownTheRequestAnswers503AndStoresNothing() throws Exception {
        mail.failNextMails(true);
        requestDeletion("tr").andExpect(status().isServiceUnavailable());
        mail.failNextMails(false);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM account_deletion_requests WHERE user_id = ?",
                Integer.class, idOf(email)));
    }

    // ---- helpers ----------------------------------------------------------------------------------------

    private UUID idOf(String address) {
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, address);
    }

    private long deletionMails(String address) {
        return mail.all().stream()
                .filter(sent -> "ACCOUNT_DELETION".equals(sent.kind()) && sent.recipient().equalsIgnoreCase(address)).count();
    }

    private static String tokenOf(String link) {
        return link.substring(link.indexOf("token=") + "token=".length());
    }

    private ResultActions requestDeletion(String locale) throws Exception {
        return requestDeletion(access, locale);
    }

    private ResultActions requestDeletion(Cookie session, String locale) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/account/deletion/request").cookie(csrf, session)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"locale\":\"" + locale + "\"}"));
    }

    private ResultActions confirm(String token, String address, String password, String code) throws Exception {
        StringBuilder body = new StringBuilder("{\"token\":\"").append(token).append("\",\"email\":\"").append(address).append('"');
        if (password != null) {
            body.append(",\"password\":\"").append(password).append('"');
        }
        if (code != null) {
            body.append(",\"code\":\"").append(code).append('"');
        }
        return mvc.perform(withCsrf(post("/api/v1/auth/account/deletion/confirm"), body.append('}').toString()));
    }

    private String registerAndVerify() throws Exception {
        return registerAndVerify(UUID.randomUUID() + "@example.test");
    }

    private String registerAndVerify(String address) throws Exception {
        mvc.perform(withCsrf(post("/api/v1/auth/register"), "{\"email\":\"" + address + "\",\"nickname\":\"u"
                        + UUID.randomUUID().toString().replace("-", "").substring(0, 20) + "\",\"password\":\"" + PASSWORD
                        + "\",\"confirmPassword\":\"" + PASSWORD + "\",\"locale\":\"tr\"}"))
                .andExpect(status().isOk());
        mvc.perform(withCsrf(post("/api/v1/auth/register/verify"),
                        "{\"email\":\"" + address + "\",\"code\":\"" + mail.lastSecretFor(address) + "\"}"))
                .andExpect(status().isOk());
        return address;
    }

    private Cookie login(String address) throws Exception {
        Cookie cookie = mvc.perform(withCsrf(post("/api/v1/auth/login"), loginBody(address, PASSWORD)))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("PDA_ACCESS");
        assertNotNull(cookie);
        return cookie;
    }

    /** A provider-only account has no password, so it gets its session straight from the login service's tokens. */
    private Cookie oauthAccess(String subject, String providerEmail) {
        var result = oauth.login(new OAuthLoginService.Profile(OAuthProvider.GOOGLE, subject, providerEmail, true, "Ada"), null);
        assertFalse(result.needsSecondFactor());
        return new Cookie("PDA_ACCESS", result.tokens().access());
    }

    private void createProject(Cookie session, String name) throws Exception {
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/projects").cookie(csrf, session).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated());
    }

    private MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request, String body) throws Exception {
        Cookie csrf = csrf();
        MockHttpServletRequestBuilder builder = request.cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue());
        return body == null ? builder : builder.contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static String loginBody(String address, String password) {
        return "{\"email\":\"" + address + "\",\"password\":\"" + password + "\"}";
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
