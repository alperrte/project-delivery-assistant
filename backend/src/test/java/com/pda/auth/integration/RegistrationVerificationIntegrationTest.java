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
import com.pda.auth.application.service.MailLocale;
import com.pda.auth.application.service.RegistrationWorkflow;
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
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

/** Registration with a mailed code: pending accounts, single use, expiry, attempt limit, resend and cleanup. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import(CapturingMailConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RegistrationVerificationIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    private static final byte[] HMAC_KEY = new byte[32];
    static { new SecureRandom().nextBytes(HMAC_KEY); }

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
        registry.add("auth.rate-limit.sensitive-max-requests", () -> "1000");
        registry.add("auth.rate-limit.login-max-requests", () -> "1000");
    }

    private static final String PASSWORD = "Strong-Pass1";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired RegistrationWorkflow workflow;
    @Autowired CapturingMailConfiguration.CapturingMailPort mail;

    @BeforeEach
    void resetMail() {
        mail.clear();
    }

    @Test
    void pendingAccountCannotLogInButTheMailedCodeActivatesIt() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());

        assertEquals(1, mail.countFor(email));
        String code = mail.lastSecretFor(email);
        assertTrue(code.matches("\\d{6}"));
        assertEquals(AccountStatus.PENDING_VERIFICATION, users.findByEmail(email).orElseThrow().getAccountStatus());
        // The code is stored only as a hash.
        assertFalse(jdbc.queryForObject("SELECT code_hash FROM email_verification_challenges WHERE user_id = ?",
                String.class, users.findByEmail(email).orElseThrow().getId()).contains(code));

        login(email, PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("email_not_verified"));
        login(email, "Wrong-Pass1").andExpect(status().isUnauthorized());

        verify(email, code).andExpect(status().isOk());
        assertEquals(AccountStatus.ACTIVE, users.findByEmail(email).orElseThrow().getAccountStatus());
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void codeWorksOnlyOnce() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());
        String code = mail.lastSecretFor(email);

        verify(email, code).andExpect(status().isOk());
        // The account is active now, so the same code finds nothing to verify.
        verify(email, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification_code_invalid"));
    }

    @Test
    void codeIsRefusedAfterFifteenMinutes() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());
        String code = mail.lastSecretFor(email);
        jdbc.update("UPDATE email_verification_challenges SET expires_at = now() - interval '1 second' "
                + "WHERE user_id = ?", users.findByEmail(email).orElseThrow().getId());

        verify(email, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification_code_expired"));
        assertEquals(AccountStatus.PENDING_VERIFICATION, users.findByEmail(email).orElseThrow().getAccountStatus());
    }

    @Test
    void codeLivesFifteenMinutes() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());
        long minutes = jdbc.queryForObject(
                "SELECT round(extract(epoch FROM (expires_at - issued_at)) / 60) FROM email_verification_challenges "
                        + "WHERE user_id = ?", Long.class, users.findByEmail(email).orElseThrow().getId());
        assertEquals(15, minutes);
    }

    @Test
    void fiveWrongGuessesLockTheCodeEvenForTheRightOne() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());
        String code = mail.lastSecretFor(email);
        String wrong = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 5; i++) {
            verify(email, wrong).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("verification_code_invalid"));
        }
        verify(email, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("verification_too_many_attempts"));
        login(email, PASSWORD).andExpect(status().isForbidden());
    }

    @Test
    void resendIsAnsweredTheSameForUnknownEmailsAndHonoursTheCooldown() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());

        String unknown = newEmail();
        resend(unknown).andExpect(status().isAccepted());
        assertEquals(0, mail.countFor(unknown));

        // Inside the 60 second cooldown nothing new is mailed, yet the answer stays 202.
        resend(email).andExpect(status().isAccepted());
        assertEquals(1, mail.countFor(email));

        String firstCode = mail.lastSecretFor(email);
        jdbc.update("UPDATE email_verification_challenges SET last_sent_at = now() - interval '2 minutes' "
                + "WHERE user_id = ?", users.findByEmail(email).orElseThrow().getId());
        resend(email).andExpect(status().isAccepted());
        assertEquals(2, mail.countFor(email));
        String secondCode = mail.lastSecretFor(email);

        if (!firstCode.equals(secondCode)) {
            // The older code stops working the moment a new one is issued.
            verify(email, firstCode).andExpect(status().isBadRequest());
        }
        verify(email, secondCode).andExpect(status().isOk());
    }

    @Test
    void registeringAgainWithAPendingEmailReplacesTheOldAttempt() throws Exception {
        String email = newEmail();
        register(email, newNickname()).andExpect(status().isOk());
        var firstId = users.findByEmail(email).orElseThrow().getId();
        String firstCode = mail.lastSecretFor(email);

        register(email, newNickname()).andExpect(status().isOk());
        var second = users.findByEmail(email).orElseThrow();
        assertFalse(firstId.equals(second.getId()));
        assertEquals(2, mail.countFor(email));
        if (!firstCode.equals(mail.lastSecretFor(email))) {
            verify(email, firstCode).andExpect(status().isBadRequest());
        }
        verify(email, mail.lastSecretFor(email)).andExpect(status().isOk());
    }

    @Test
    void nicknameHeldByALivePendingRegistrationIsAConflictUntilItsCodeRunsOut() throws Exception {
        String nickname = newNickname();
        register(newEmail(), nickname).andExpect(status().isOk());

        String other = newEmail();
        register(other, nickname).andExpect(status().isConflict());
        assertTrue(users.findByEmail(other).isEmpty());

        jdbc.update("UPDATE email_verification_challenges SET expires_at = now() - interval '1 second' "
                + "WHERE user_id = (SELECT id FROM users WHERE nickname = ?)", nickname);
        register(other, nickname).andExpect(status().isOk());
        assertTrue(users.findByEmail(other).isPresent());
    }

    @Test
    void cleanupDeletesOnlyExpiredPendingRegistrationsAndFreesTheEmail() throws Exception {
        String stale = newEmail();
        String fresh = newEmail();
        register(stale, newNickname()).andExpect(status().isOk());
        register(fresh, newNickname()).andExpect(status().isOk());
        String verified = newEmail();
        register(verified, newNickname()).andExpect(status().isOk());
        verify(verified, mail.lastSecretFor(verified)).andExpect(status().isOk());

        jdbc.update("UPDATE email_verification_challenges SET expires_at = now() - interval '1 second' "
                + "WHERE user_id = ?", users.findByEmail(stale).orElseThrow().getId());
        assertTrue(workflow.purgeExpiredPending() >= 1);

        assertTrue(users.findByEmail(stale).isEmpty());
        assertTrue(users.findByEmail(fresh).isPresent());
        assertEquals(AccountStatus.ACTIVE, users.findByEmail(verified).orElseThrow().getAccountStatus());
        // The email is free again.
        register(stale, newNickname()).andExpect(status().isOk());
    }

    @Test
    void mailFailureLeavesNothingBehind() throws Exception {
        String email = newEmail();
        String nickname = newNickname();
        mail.failNextMails(true);
        register(email, nickname).andExpect(status().isServiceUnavailable());

        assertTrue(users.findByEmail(email).isEmpty());
        mail.failNextMails(false);
        register(email, nickname).andExpect(status().isOk());
    }

    @Test
    void mailIsWrittenInTheRequestedLanguage() throws Exception {
        String email = newEmail();
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerJson(email, newNickname(), "de"))).andExpect(status().isOk());
        assertEquals(MailLocale.DE, mail.all().get(mail.all().size() - 1).locale());
    }

    @Test
    void weakPasswordsAreRefused() throws Exception {
        for (String weak : new String[] {"aaaaaaaa", "Aaaaaaaa", "Aaaaaaa1", "Aa1!", "aaaaaaa1!"}) {
            String email = newEmail();
            Cookie csrf = csrf();
            mvc.perform(post("/api/v1/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"" + email + "\",\"nickname\":\"" + newNickname()
                                    + "\",\"password\":\"" + weak + "\",\"confirmPassword\":\"" + weak + "\"}"))
                    .andExpect(status().isBadRequest());
            assertTrue(users.findByEmail(email).isEmpty());
        }
    }

    // --- helpers -----------------------------------------------------------------------------------------------

    private ResultActions register(String email, String nickname) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(registerJson(email, nickname, "tr")));
    }

    private ResultActions verify(String email, String code) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/register/verify").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"));
    }

    private ResultActions resend(String email) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/register/resend").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"locale\":\"tr\"}"));
    }

    private ResultActions login(String email, String password) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private static String registerJson(String email, String nickname, String locale) {
        return "{\"email\":\"" + email + "\",\"nickname\":\"" + nickname + "\",\"password\":\"" + PASSWORD
                + "\",\"confirmPassword\":\"" + PASSWORD + "\",\"locale\":\"" + locale + "\"}";
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private static String newEmail() {
        return UUID.randomUUID() + "@example.test";
    }

    private static String newNickname() {
        return "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
    }
}
