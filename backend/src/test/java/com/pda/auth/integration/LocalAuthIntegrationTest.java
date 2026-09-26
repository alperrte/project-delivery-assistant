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
import com.pda.user.domain.enums.AccountStatus;
import com.pda.user.domain.enums.EmailVerificationStatus;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.springdoc.core.properties.SwaggerUiConfigProperties;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class LocalAuthIntegrationTest {

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
        registry.add("MAIL_ENABLED", () -> "true");
        registry.add("API_DOCS_ENABLED", () -> "true");
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;
    @Autowired SwaggerUiConfigProperties swaggerUiProperties;

    @Test
    void enabledApiDocsServeSwaggerUiAndOpenApiJson() throws Exception {
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
        mvc.perform(get("/swagger-ui/swagger-ui.css")).andExpect(status().isOk());
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.responses['200']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/logout'].post.responses['200']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/register'].post.responses['200']").exists())
                .andExpect(jsonPath("$.components.schemas.RegisterRequest.properties.password.minLength").value(8));
        mvc.perform(get("/v3/api-docs/swagger-config")).andExpect(status().isOk());
        assertTrue(swaggerUiProperties.isCsrfEnabled());
    }

    @Test
    void registerLoginMeLogoutFlowNeedsNoEmail() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        String nickname = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        String password = UUID.randomUUID().toString().substring(0, 8);
        Cookie csrf = csrfCookie();

        mvc.perform(post("/api/v1/auth/register").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"nickname\":\"" + nickname
                                + "\",\"password\":\"" + password + "\",\"confirmPassword\":\""
                                + password + "\"}"))
                .andExpect(status().isOk());
        var user = users.findByEmail(email).orElseThrow();
        assertEquals(AccountStatus.ACTIVE, user.getAccountStatus());
        assertEquals(EmailVerificationStatus.PENDING, user.getEmailVerificationStatus());
        assertEquals(null, user.getEmailVerifiedAt());

        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS");
        Cookie refresh = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_REFRESH");
        assertTrue(login.getHeaders(HttpHeaders.SET_COOKIE).stream().allMatch(value ->
                value.contains("HttpOnly") && value.contains("SameSite=Lax")));
        String persistedRefresh = jdbc.queryForObject(
                "SELECT refresh_token_hash FROM user_sessions WHERE user_id = ?", String.class, user.getId());
        assertFalse(refresh.getValue().equals(persistedRefresh));
        assertTrue(persistedRefresh.matches("[0-9a-f]{64}"));

        mvc.perform(get("/api/v1/auth/me").cookie(access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("PDA_ACCESS", access.getValue() + "x")))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/logout").cookie(csrf, refresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk());
        assertNotNull(jdbc.queryForObject(
                "SELECT revoked_at FROM user_sessions WHERE user_id = ?", java.sql.Timestamp.class, user.getId()));
        mvc.perform(get("/api/v1/auth/me").cookie(access))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesTokensAndRejectsOldRefreshToken() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        String password = UUID.randomUUID().toString();
        User user = users.saveAndFlush(User.registerLocalActive(email,
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), password, encoder));
        Cookie csrf = csrfCookie();

        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()).header("User-Agent", "IntegrationTest/1.0")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie oldRefresh = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_REFRESH");
        assertEquals("IntegrationTest/1.0", jdbc.queryForObject(
                "SELECT user_agent FROM user_sessions WHERE user_id = ?", String.class, user.getId()));

        var refreshed = mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, oldRefresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie newAccess = cookie(refreshed.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS");
        Cookie newRefresh = cookie(refreshed.getHeaders(HttpHeaders.SET_COOKIE), "PDA_REFRESH");
        assertFalse(newRefresh.getValue().equals(oldRefresh.getValue()));
        assertTrue(refreshed.getHeaders(HttpHeaders.SET_COOKIE).stream().allMatch(value ->
                value.contains("HttpOnly") && value.contains("SameSite=Lax")));
        assertEquals(1, jdbc.queryForObject(
                "SELECT count(*) FROM user_sessions WHERE user_id = ?", Integer.class, user.getId()));
        String storedHash = jdbc.queryForObject(
                "SELECT refresh_token_hash FROM user_sessions WHERE user_id = ?", String.class, user.getId());
        assertTrue(storedHash.matches("[0-9a-f]{64}"));
        assertFalse(storedHash.equals(newRefresh.getValue()));

        mvc.perform(get("/api/v1/auth/me").cookie(newAccess))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(email));
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, oldRefresh)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, new Cookie("PDA_REFRESH", newRefresh.getValue() + "x"))
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(newRefresh))
                .andExpect(status().isForbidden());
    }

    @Test
    void disabledAccountCannotRefresh() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        String password = UUID.randomUUID().toString();
        User user = users.saveAndFlush(User.registerLocalActive(email,
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20), password, encoder));
        Cookie csrf = csrfCookie();
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie refresh = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_REFRESH");
        user.disable();
        users.saveAndFlush(user);
        mvc.perform(post("/api/v1/auth/refresh").cookie(csrf, refresh).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongPasswordCannotLogInAndVerificationRoutesAreClosed() throws Exception {
        Cookie csrf = csrfCookie();
        mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"missing@example.test\",\"password\":\"wrong-value\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/verify-email").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
    }

    @Test
    void disabledAccountCannotLogIn() throws Exception {
        String email = UUID.randomUUID() + "@example.test";
        String password = UUID.randomUUID().toString();
        User user = User.registerLocalActive(email, "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20),
                password, encoder);
        user.disable();
        users.saveAndFlush(user);
        Cookie csrf = csrfCookie();
        mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        assertFalse(value.isBlank());
        return new Cookie(name, value);
    }
}
