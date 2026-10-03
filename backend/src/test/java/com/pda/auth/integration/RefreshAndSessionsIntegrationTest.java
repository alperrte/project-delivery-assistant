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
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
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

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RefreshAndSessionsIntegrationTest {

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
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;

    @Test
    void reusingAnOldRefreshTokenRevokesTheSession() throws Exception {
        Account account = newAccount();
        Cookie csrf = csrfCookie();
        Tokens first = login(account, csrf, "Replay/1.0");
        Tokens second = refresh(first.refresh, csrf);

        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, first.refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());

        assertNotNull(jdbc.queryForObject("SELECT revoked_at FROM user_sessions WHERE user_id = ?",
                java.sql.Timestamp.class, account.user.getId()));
        mvc.perform(get("/api/v1/auth/me").cookie(second.access)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, second.refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?",
                Integer.class, account.user.getId()));
    }

    @Test
    void authenticatedResponsesTellHowLongTheAccessTokenStaysValidAndTheBrowserMayReadIt() throws Exception {
        Account account = newAccount();
        Cookie csrf = csrfCookie();
        Tokens tokens = login(account, csrf, "Expiry/1.0");

        // The header is the time left of the access token that authenticated the request, in milliseconds: just
        // under the 15 minutes it was issued for.
        String payload = new String(java.util.Base64.getUrlDecoder().decode(tokens.access.getValue().split("[.]")[1]),
                java.nio.charset.StandardCharsets.UTF_8);
        long expMillis = ((Number) com.jayway.jsonpath.JsonPath.read(payload, "$.exp")).longValue() * 1000;
        String header = mvc.perform(get("/api/v1/auth/me").cookie(tokens.access))
                .andExpect(status().isOk()).andReturn().getResponse().getHeader("X-Access-Token-Expires-In");
        org.junit.jupiter.api.Assertions.assertNotNull(header);
        long remaining = Long.parseLong(header);
        org.junit.jupiter.api.Assertions.assertTrue(remaining > 14 * 60_000L && remaining <= 15 * 60_000L,
                "remaining " + remaining);
        org.junit.jupiter.api.Assertions.assertTrue(Math.abs(System.currentTimeMillis() + remaining - expMillis) < 5_000,
                "the header must match the exp of the token");

        // Without a valid session there is nothing to announce.
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .doesNotExist("X-Access-Token-Expires-In"));

        // The frontend lives on another origin, so CORS has to expose the header to its scripts.
        mvc.perform(get("/api/v1/auth/me").cookie(tokens.access)
                        .header(org.springframework.http.HttpHeaders.ORIGIN, "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Access-Control-Expose-Headers", org.hamcrest.Matchers.containsString("X-Access-Token-Expires-In")));
    }

    @Test
    void loggedOutRefreshTokenCannotCreateASession() throws Exception {
        Account account = newAccount();
        Cookie csrf = csrfCookie();
        Tokens tokens = login(account, csrf, null);
        mvc.perform(post("/api/v1/auth/logout").cookie(csrf, tokens.refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, tokens.refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?",
                Integer.class, account.user.getId()));
    }

    @Test
    void sessionListAndRevokeFlow() throws Exception {
        Account account = newAccount();
        Cookie csrf = csrfCookie();
        Tokens laptop = login(account, csrf, "Laptop/1.0");
        Tokens phone = login(account, csrf, "Phone/1.0");
        laptop = refresh(laptop.refresh, csrf);

        mvc.perform(get("/api/v1/auth/sessions")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/sessions/revoke-others").cookie(laptop.access))
                .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/auth/sessions").cookie(laptop.access))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.userAgent=='Laptop/1.0')].current").value(true))
                .andExpect(jsonPath("$[?(@.userAgent=='Phone/1.0')].current").value(false));

        UUID phoneSession = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM user_sessions WHERE user_agent = 'Phone/1.0' AND user_id = ?",
                String.class, account.user.getId()));

        Account other = newAccount();
        Tokens otherTokens = login(other, csrf, "Other/1.0");
        mvc.perform(post("/api/v1/auth/sessions/" + phoneSession + "/revoke").cookie(csrf, otherTokens.access)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/auth/me").cookie(phone.access)).andExpect(status().isOk());

        mvc.perform(post("/api/v1/auth/sessions/revoke-others").cookie(csrf, laptop.access)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revoked").value(1));
        mvc.perform(get("/api/v1/auth/me").cookie(phone.access)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/me").cookie(laptop.access)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/auth/sessions/" + phoneSession + "/revoke").cookie(csrf, laptop.access)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());

        UUID laptopSession = UUID.fromString(jdbc.queryForObject(
                "SELECT id::text FROM user_sessions WHERE user_agent = 'Laptop/1.0' AND user_id = ?",
                String.class, account.user.getId()));
        var revoked = mvc.perform(post("/api/v1/auth/sessions/" + laptopSession + "/revoke")
                        .cookie(csrf, laptop.access).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse();
        assertTrue(revoked.getHeaders(HttpHeaders.SET_COOKIE).stream().anyMatch(value ->
                value.startsWith("PDA_ACCESS=") && value.contains("Max-Age=0")));
        mvc.perform(get("/api/v1/auth/me").cookie(laptop.access)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/auth/sessions").cookie(laptop.access)).andExpect(status().isUnauthorized());
    }

    private record Account(User user, String password) {}

    private record Tokens(Cookie access, Cookie refresh) {}

    private Account newAccount() {
        String password = UUID.randomUUID().toString();
        User user = users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), password, encoder));
        return new Account(user, password);
    }

    private Tokens login(Account account, Cookie csrf, String userAgent) throws Exception {
        var request = post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + account.user.getEmail() + "\",\"password\":\""
                        + account.password + "\"}");
        if (userAgent != null) {
            request.header("User-Agent", userAgent);
        }
        return tokens(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse()
                .getHeaders(HttpHeaders.SET_COOKIE));
    }

    private Tokens refresh(Cookie refresh, Cookie csrf) throws Exception {
        return tokens(mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse().getHeaders(HttpHeaders.SET_COOKIE));
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private static Tokens tokens(java.util.Collection<String> headers) {
        return new Tokens(cookie(headers, "PDA_ACCESS"), cookie(headers, "PDA_REFRESH"));
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        assertFalse(value.isBlank());
        return new Cookie(name, value);
    }
}
