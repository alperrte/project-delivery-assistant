package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
 * The administrator sign-in on an instance with the production rate limits and no TOTP_ENCRYPTION_KEY: the rate limit
 * answers 429 after five attempts per address on every administrator endpoint, and a missing key fails closed with a
 * controlled 503 (no ticket, no session, never a 500) on the administrator and on the regular two-factor path.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminAuthHardeningIntegrationTest {

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
        // No TOTP_ENCRYPTION_KEY and no rate-limit overrides: the production limits (5 sensitive per 10 minutes) apply.
        // Set explicitly, because pre-push loads the root .env into the process environment and a real key or relaxed
        // limit from there would otherwise leak into this test.
        registry.add("TOTP_ENCRYPTION_KEY", () -> "");
        registry.add("auth.rate-limit.sensitive-max-requests", () -> "5");
        registry.add("auth.rate-limit.login-max-requests", () -> "30");
    }

    private static final String PASSWORD = "Strong-Pass1";
    private static final AtomicInteger ADDRESSES = new AtomicInteger();

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;

    @Test
    void withoutAKeyTheAdministratorSignInFailsClosedBeforeAnyTicketAndSaysNothingAboutTheAccount() throws Exception {
        User admin = newUser("ADMIN");
        for (String[] attempt : new String[][] {{admin.getEmail(), PASSWORD}, {admin.getEmail(), "Wrong-Pass1"},
                {UUID.randomUUID() + "@example.test", PASSWORD}}) {
            MockHttpServletResponse response = fromNewAddress("/api/v1/auth/admin/login",
                    "{\"email\":\"" + attempt[0] + "\",\"password\":\"" + attempt[1] + "\"}")
                    .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("two_factor_unavailable"))
                    .andReturn().getResponse();
            assertNull(response.getCookie("PDA_ADMIN_MFA"));
            assertNull(response.getCookie("PDA_ADMIN_ENROLL"));
            assertNull(response.getCookie("PDA_ACCESS"));
        }
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM admin_auth_tickets", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions", Integer.class));
    }

    @Test
    void theRegularSecondStepAnswers503NotAnInternalErrorWhenTheSecretCannotBeRead() throws Exception {
        User user = newUser("USER");
        jdbc.update("INSERT INTO totp_credentials (id, user_id, secret_encrypted, confirmed_at, last_used_step,"
                        + " failed_attempts, created_at, version) VALUES (?, ?, ?, now(), 0, 0, now(), 0)",
                UUID.randomUUID(), user.getId(), Base64.getEncoder().encodeToString(new byte[48]));
        Cookie pending = fromNewAddress("/api/v1/auth/login",
                "{\"email\":\"" + user.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("TWO_FACTOR_REQUIRED"))
                .andReturn().getResponse().getCookie("PDA_MFA");
        assertNotNull(pending);
        fromNewAddress("/api/v1/auth/login/2fa", "{\"code\":\"123456\"}", pending)
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("two_factor_unavailable"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, user.getId()));
    }

    @Test
    void everyAdministratorEndpointIsLimitedToFiveRequestsPerAddress() throws Exception {
        for (String path : new String[] {"/api/v1/auth/admin/login", "/api/v1/auth/admin/login/2fa",
                "/api/v1/auth/admin/2fa/setup", "/api/v1/auth/admin/2fa/enable"}) {
            String address = "admin-limit-" + ADDRESSES.incrementAndGet();
            String body = path.endsWith("/login") ? "{\"email\":\"nobody@example.test\",\"password\":\"" + PASSWORD + "\"}"
                    : "{\"code\":\"000000\"}";
            for (int attempt = 1; attempt <= 5; attempt++) {
                mvcPost(path, body, address).andExpect(status().is(org.hamcrest.Matchers.not(429)));
            }
            mvcPost(path, body, address).andExpect(status().isTooManyRequests())
                    .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
            // Another address is not affected.
            mvcPost(path, body, "admin-limit-" + ADDRESSES.incrementAndGet()).andExpect(status().is(org.hamcrest.Matchers.not(429)));
        }
    }

    private User newUser(String role) {
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), PASSWORD, encoder));
        if (!"USER".equals(role)) {
            jdbc.update("UPDATE users SET global_role = ? WHERE id = ?", role, user.getId());
        }
        return user;
    }

    private ResultActions fromNewAddress(String path, String body, Cookie... cookies) throws Exception {
        return mvcPost(path, body, "hardening-" + ADDRESSES.incrementAndGet(), cookies);
    }

    private ResultActions mvcPost(String path, String body, String address, Cookie... cookies) throws Exception {
        Cookie csrf = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(csrf);
        java.util.List<Cookie> all = new java.util.ArrayList<>(java.util.List.of(csrf));
        all.addAll(java.util.List.of(cookies));
        var request = post(path).cookie(all.toArray(Cookie[]::new)).header("X-XSRF-TOKEN", csrf.getValue())
                .with(servlet -> { servlet.setRemoteAddr(address); return servlet; })
                .contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request);
    }
}
