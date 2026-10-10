package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Proves that tokens really run out and that a session really ends: the whole application runs on a clock the test
 * moves forward, so the 15-minute access token and the 7-day refresh token are exercised at their real lifetimes.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Import({CapturingMailConfiguration.class, SessionExpiryIntegrationTest.MovableClockConfiguration.class})
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SessionExpiryIntegrationTest {

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
        registry.add("auth.rate-limit.refresh-max-requests", () -> "1000");
    }

    private static final String PASSWORD = "Strong-Pass1";

    @Autowired MockMvc mvc;
    @Autowired MovableClock clock;
    @Autowired CapturingMailConfiguration.CapturingMailPort mail;

    private String email;

    @BeforeEach
    void newUser() throws Exception {
        clock.set(Instant.now());
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
    void accessTokenWorksForFifteenMinutesAndThenTheSessionIsOver() throws Exception {
        Cookie[] session = login();

        me(session[0]).andExpect(status().isOk());
        clock.advance(Duration.ofMinutes(14).plusSeconds(59));
        me(session[0]).andExpect(status().isOk());
        clock.advance(Duration.ofSeconds(2));
        me(session[0]).andExpect(status().isUnauthorized());
    }

    @Test
    void anExpiredAccessTokenIsRenewedByRefreshAndTheUsedRefreshTokenDies() throws Exception {
        Cookie[] session = login();
        clock.advance(Duration.ofMinutes(16));
        me(session[0]).andExpect(status().isUnauthorized());

        var renewed = refresh(session[1]).andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = renewed.getCookie("PDA_ACCESS");
        Cookie refresh = renewed.getCookie("PDA_REFRESH");
        assertNotNull(access);
        assertNotNull(refresh);

        me(access).andExpect(status().isOk());
        // Rotation: the refresh token that was just used is dead, and replaying it ends the whole session.
        refresh(session[1]).andExpect(status().isUnauthorized());
        refresh(refresh).andExpect(status().isUnauthorized());
        me(access).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshTokenLivesSevenDaysAndThenLoginIsRequired() throws Exception {
        Cookie[] session = login();

        clock.advance(Duration.ofDays(7).minusMinutes(1));
        refresh(session[1]).andExpect(status().isOk());

        // That refresh opened a fresh 7-day window on a rotated token; the one from the first login is long dead.
        Cookie[] second = login();
        clock.advance(Duration.ofDays(7).plusMinutes(1));
        refresh(second[1]).andExpect(status().isUnauthorized());
        me(second[0]).andExpect(status().isUnauthorized());
    }

    @Test
    void loggingOutEndsTheSessionEvenWhileTheAccessTokenIsStillInDate() throws Exception {
        Cookie[] session = login();
        me(session[0]).andExpect(status().isOk());

        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/logout").cookie(csrf, session[1]).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());

        me(session[0]).andExpect(status().isUnauthorized());
        refresh(session[1]).andExpect(status().isUnauthorized());
    }

    @Test
    void aRevokedOtherSessionStopsWorkingImmediately() throws Exception {
        Cookie[] first = login();
        Cookie[] second = login();

        Cookie csrf = csrf();
        mvc.perform(post("/api/v1/auth/sessions/revoke-others").cookie(csrf, second[0])
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().is2xxSuccessful());

        me(first[0]).andExpect(status().isUnauthorized());
        refresh(first[1]).andExpect(status().isUnauthorized());
        me(second[0]).andExpect(status().isOk());
    }

    @Test
    void aTamperedAccessTokenIsRefused() throws Exception {
        Cookie[] session = login();
        String value = session[0].getValue();
        String tampered = value.substring(0, value.length() - 2) + (value.endsWith("AA") ? "BB" : "AA");

        me(new Cookie("PDA_ACCESS", tampered)).andExpect(status().isUnauthorized());
    }

    @Test
    void theRefreshTokenCannotBeUsedAsAnAccessToken() throws Exception {
        Cookie[] session = login();

        me(new Cookie("PDA_ACCESS", session[1].getValue())).andExpect(status().isUnauthorized());
    }

    // ---- helpers ----------------------------------------------------------------------------------------

    /** Logs in and returns {access cookie, refresh cookie}. */
    private Cookie[] login() throws Exception {
        Cookie csrf = csrf();
        var response = mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = response.getCookie("PDA_ACCESS");
        Cookie refresh = response.getCookie("PDA_REFRESH");
        assertNotNull(access);
        assertNotNull(refresh);
        return new Cookie[] {access, refresh};
    }

    private ResultActions me(Cookie access) throws Exception {
        return mvc.perform(get("/api/v1/auth/me").cookie(access));
    }

    private ResultActions refresh(Cookie refresh) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, refresh).header("X-XSRF-TOKEN", csrf.getValue()));
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    /** The application clock, which the tests move forward by hand. */
    static final class MovableClock extends Clock {
        private volatile Instant now = Instant.now();

        void set(Instant instant) { now = instant; }

        void advance(Duration duration) { now = now.plus(duration); }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }

        @Override public Clock withZone(ZoneId zone) { return this; }

        @Override public Instant instant() { return now; }
    }

    @TestConfiguration
    static class MovableClockConfiguration {
        @Bean
        @Primary
        MovableClock movableClock() {
            return new MovableClock();
        }
    }
}
