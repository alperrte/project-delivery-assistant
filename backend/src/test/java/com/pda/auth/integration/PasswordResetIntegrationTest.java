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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Forgot password in three steps: mailed code, ticket cookie, new password. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import(CapturingMailConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class PasswordResetIntegrationTest {

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
    private static final String TICKET = "PDA_RESET";

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired CapturingMailConfiguration.CapturingMailPort mail;

    @BeforeEach
    void resetMail() {
        mail.clear();
    }

    @Test
    void threeStepsSetTheNewPasswordAndOldOneStopsWorking() throws Exception {
        String email = activeUser();
        forgot(email).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        assertTrue(code.matches("\\d{6}"));

        MvcResult verified = verifyCode(email, code).andExpect(status().isOk()).andReturn();
        Cookie ticket = verified.getResponse().getCookie(TICKET);
        assertNotNull(ticket);
        assertTrue(ticket.isHttpOnly());
        assertEquals("/api/v1/auth/password", ticket.getPath());

        reset(ticket, NEW_PASSWORD).andExpect(status().isOk());

        login(email, PASSWORD).andExpect(status().isUnauthorized());
        login(email, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void ticketWorksOnlyOnce() throws Exception {
        String email = activeUser();
        Cookie ticket = ticketFor(email);

        reset(ticket, NEW_PASSWORD).andExpect(status().isOk());
        reset(ticket, "Another-Pass3").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_ticket_invalid"));
        login(email, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void codeWorksOnlyOnce() throws Exception {
        String email = activeUser();
        forgot(email).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);

        verifyCode(email, code).andExpect(status().isOk());
        verifyCode(email, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_code_invalid"));
    }

    @Test
    void aNewCodeRetiresTheTicketOfTheOldOne() throws Exception {
        String email = activeUser();
        Cookie oldTicket = ticketFor(email);
        jdbc.update("UPDATE password_reset_challenges SET last_sent_at = now() - interval '2 minutes' "
                + "WHERE user_id = ?", users.findByEmail(email).orElseThrow().getId());
        forgot(email).andExpect(status().isAccepted());
        assertEquals(2, mail.countFor(email));

        reset(oldTicket, NEW_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_ticket_invalid"));
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void missingOrForgedTicketsAreRefused() throws Exception {
        String email = activeUser();
        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/password/reset").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(resetJson(NEW_PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_ticket_invalid"));
        reset(new Cookie(TICKET, "not.a.jwt"), NEW_PASSWORD).andExpect(status().isBadRequest());

        // A login access token must not be accepted as a reset ticket.
        MvcResult loggedIn = login(email, PASSWORD).andExpect(status().isOk()).andReturn();
        Cookie access = loggedIn.getResponse().getCookie("PDA_ACCESS");
        assertNotNull(access);
        reset(new Cookie(TICKET, access.getValue()), NEW_PASSWORD).andExpect(status().isBadRequest());
        login(email, PASSWORD).andExpect(status().isOk());
    }

    @Test
    void wrongCodeIsRefusedAndFiveGuessesLockIt() throws Exception {
        String email = activeUser();
        forgot(email).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        String wrong = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 5; i++) {
            verifyCode(email, wrong).andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("reset_code_invalid"));
        }
        verifyCode(email, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_too_many_attempts"));
    }

    @Test
    void codeIsRefusedAfterFifteenMinutes() throws Exception {
        String email = activeUser();
        forgot(email).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        long minutes = jdbc.queryForObject(
                "SELECT round(extract(epoch FROM (expires_at - issued_at)) / 60) FROM password_reset_challenges "
                        + "WHERE user_id = ?", Long.class, users.findByEmail(email).orElseThrow().getId());
        assertEquals(15, minutes);
        jdbc.update("UPDATE password_reset_challenges SET expires_at = now() - interval '1 second' "
                + "WHERE user_id = ?", users.findByEmail(email).orElseThrow().getId());

        verifyCode(email, code).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_code_expired"));
    }

    @Test
    void unknownEmailGetsNoMailAndNoTicket() throws Exception {
        String email = newEmail();
        forgot(email).andExpect(status().isAccepted());
        assertEquals(0, mail.countFor(email));
        verifyCode(email, "123456").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_code_invalid"));
    }

    @Test
    void weakNewPasswordIsRefusedAndTheTicketSurvivesIt() throws Exception {
        String email = activeUser();
        Cookie ticket = ticketFor(email);

        reset(ticket, "aaaaaaaa").andExpect(status().isBadRequest());
        reset(ticket, NEW_PASSWORD).andExpect(status().isOk());
    }

    @Test
    void resetEndsEveryExistingSession() throws Exception {
        String email = activeUser();
        MvcResult loggedIn = login(email, PASSWORD).andExpect(status().isOk()).andReturn();
        Cookie access = loggedIn.getResponse().getCookie("PDA_ACCESS");
        assertNotNull(access);
        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isOk());

        reset(ticketFor(email), NEW_PASSWORD).andExpect(status().isOk());

        mvc.perform(get("/api/v1/auth/me").cookie(access)).andExpect(status().isUnauthorized());
    }

    // ---- helpers ----------------------------------------------------------------------------------------

    private String activeUser() throws Exception {
        String email = newEmail();
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
        return email;
    }

    /** Runs forgot + verify and returns the ticket cookie. */
    private Cookie ticketFor(String email) throws Exception {
        forgot(email).andExpect(status().isAccepted());
        String code = mail.lastSecretFor(email);
        Cookie ticket = verifyCode(email, code).andExpect(status().isOk()).andReturn().getResponse().getCookie(TICKET);
        assertNotNull(ticket);
        return ticket;
    }

    private ResultActions forgot(String email) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/password/forgot").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"locale\":\"tr\"}"));
    }

    private ResultActions verifyCode(String email, String code) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/password/reset/verify").cookie(csrf)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"));
    }

    private ResultActions reset(Cookie ticket, String newPassword) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/password/reset").cookie(csrf, ticket)
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content(resetJson(newPassword)));
    }

    private static String resetJson(String password) {
        return "{\"newPassword\":\"" + password + "\",\"confirmPassword\":\"" + password + "\"}";
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
