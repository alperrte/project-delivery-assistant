package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
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

/** Changing the password from the account settings: a mailed code first, then old and new password. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import(CapturingMailConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PasswordChangeIntegrationTest {

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
    private static final String NEW_PASSWORD = "Brand-New-Pass2";
    private static final String TICKET = "PDA_PWCHANGE";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired CapturingMailConfiguration.CapturingMailPort mail;

    @BeforeEach
    void resetMail() {
        mail.clear();
    }

    @Test
    void codeThenOldAndNewPasswordChangeIt() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);

        sendCode(access).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        assertTrue(code.matches("\\d{6}"));
        Cookie ticket = verifyCode(access, code).andExpect(status().isOk()).andReturn().getResponse().getCookie(TICKET);
        assertNotNull(ticket);
        assertTrue(ticket.isHttpOnly());
        assertEquals("/api/v1/auth/password/change", ticket.getPath());

        change(access, ticket, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());

        login(email, PASSWORD).andExpect(status().isUnauthorized());
        login(email, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void withoutTheMailedCodeThePasswordCannotBeChanged() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);

        change(access, null, PASSWORD, NEW_PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification_required"));
        change(access, new Cookie(TICKET, "not.a.jwt"), PASSWORD, NEW_PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification_required"));
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void ticketIsSpentByASuccessfulChange() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        Cookie ticket = ticketFor(access, email);

        change(access, ticket, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
        change(access, ticket, NEW_PASSWORD, "Another-Pass3").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification_required"));
    }

    @Test
    void aWrongCurrentPasswordKeepsTheTicketForANewTry() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        Cookie ticket = ticketFor(access, email);

        change(access, ticket, "Wrong-Pass9", NEW_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("current_password_incorrect"));
        change(access, ticket, PASSWORD, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void aTicketOfAnotherAccountIsRefused() throws Exception {
        String ownerEmail = newEmail();
        Cookie ownerAccess = activeUserAccess(ownerEmail);
        Cookie ownerTicket = ticketFor(ownerAccess, ownerEmail);

        String otherEmail = newEmail();
        Cookie otherAccess = activeUserAccess(otherEmail);

        change(otherAccess, ownerTicket, PASSWORD, NEW_PASSWORD).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("verification_required"));
    }

    @Test
    void aNewCodeRetiresTheTicketOfTheOldOne() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        Cookie oldTicket = ticketFor(access, email);
        jdbc.update("UPDATE password_change_challenges SET last_sent_at = now() - interval '2 minutes' "
                + "WHERE user_id = ?", users.findByEmail(email).orElseThrow().getId());
        sendCode(access).andExpect(status().isAccepted());
        assertEquals(2, mail.countFor(email));

        change(access, oldTicket, PASSWORD, NEW_PASSWORD).andExpect(status().isForbidden());
    }

    @Test
    void sendingTwiceInsideTheCooldownMailsOnce() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);

        sendCode(access).andExpect(status().isAccepted());
        sendCode(access).andExpect(status().isAccepted());

        assertEquals(1, mail.countFor(email));
    }

    @Test
    void codeIsCheckedLikeTheOtherMailCodes() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        sendCode(access).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        String wrong = code.equals("000000") ? "111111" : "000000";

        verifyCode(access, wrong).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("change_code_invalid"));
        verifyCode(access, code).andExpect(status().isOk());
        verifyCode(access, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("change_code_invalid"));
    }

    @Test
    void fiveWrongGuessesLockTheCode() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        sendCode(access).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        String wrong = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 5; i++) {
            verifyCode(access, wrong).andExpect(status().isBadRequest());
        }
        verifyCode(access, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("change_too_many_attempts"));
    }

    @Test
    void codeIsRefusedAfterFifteenMinutes() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        sendCode(access).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        long minutes = jdbc.queryForObject(
                "SELECT round(extract(epoch FROM (expires_at - issued_at)) / 60) FROM password_change_challenges "
                        + "WHERE user_id = ?", Long.class, users.findByEmail(email).orElseThrow().getId());
        assertEquals(15, minutes);
        jdbc.update("UPDATE password_change_challenges SET expires_at = now() - interval '1 second' "
                + "WHERE user_id = ?", users.findByEmail(email).orElseThrow().getId());

        verifyCode(access, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("change_code_expired"));
    }

    @Test
    void theCodeEndpointsNeedASession() throws Exception {
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/password/change/code").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/password/change/verify").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"code\":\"123456\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aResetCodeCannotUnlockAPasswordChange() throws Exception {
        String email = newEmail();
        Cookie access = activeUserAccess(email);
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/password/forgot").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
                .andExpect(status().isAccepted());
        String resetCode = mail.lastSecretFor(email);

        verifyCode(access, resetCode).andExpect(status().isBadRequest());
    }

    // ---- helpers ----------------------------------------------------------------------------------------

    /** Registers and verifies a user, logs in and returns the access cookie. */
    private Cookie activeUserAccess(String email) throws Exception {
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"nickname\":\"" + newNickname() + "\",\"password\":\""
                                + PASSWORD + "\",\"confirmPassword\":\"" + PASSWORD + "\",\"locale\":\"tr\"}"))
                .andExpect(status().isOk());
        String code = mail.lastSecretFor(email);
        Cookie csrf2 = csrf();
        mvc.perform(post("/api/v1/auth/register/verify").cookie(csrf2).header("X-XSRF-TOKEN", csrf2.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"))
                .andExpect(status().isOk());
        mail.clear();
        Cookie access = login(email, PASSWORD).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("PDA_ACCESS");
        assertNotNull(access);
        return access;
    }

    private Cookie ticketFor(Cookie access, String email) throws Exception {
        sendCode(access).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        Cookie ticket = verifyCode(access, code).andExpect(status().isOk()).andReturn().getResponse().getCookie(TICKET);
        assertNotNull(ticket);
        return ticket;
    }

    private ResultActions sendCode(Cookie access) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/password/change/code").cookie(csrf, access)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"locale\":\"tr\"}"));
    }

    private ResultActions verifyCode(Cookie access, String code) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/password/change/verify").cookie(csrf, access)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"" + code + "\"}"));
    }

    private ResultActions change(Cookie access, Cookie ticket, String current, String next) throws Exception {
        Cookie csrf = csrf();
        Cookie[] cookies = ticket == null ? new Cookie[] {csrf, access} : new Cookie[] {csrf, access, ticket};
        return mvc.perform(post("/api/v1/auth/password/change").cookie(cookies)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next
                        + "\",\"confirmNewPassword\":\"" + next + "\"}"));
    }

    private ResultActions login(String email, String password) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
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
