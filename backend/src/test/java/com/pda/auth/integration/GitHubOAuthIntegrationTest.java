package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import com.pda.auth.application.service.OAuthLoginService;
import com.pda.auth.application.service.OAuthLoginService.FailureReason;
import com.pda.auth.application.service.OAuthLoginService.OAuthLoginException;
import com.pda.auth.application.service.OAuthLoginService.Profile;
import com.pda.auth.infrastructure.config.LinkAwareAuthorizationRequestRepository;
import com.pda.auth.infrastructure.config.OAuthLoginHandlers;
import com.pda.user.OAuthProvider;
import com.pda.user.UserAccounts;
import com.pda.user.UserAccounts.LinkOutcome;
import com.pda.user.UserAccounts.UnlinkOutcome;
import com.pda.user.domain.entity.User;
import com.pda.user.infrastructure.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import java.net.URI;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** GitHub login with a configured (fake-credential) provider; GitHub itself is never contacted. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class GitHubOAuthIntegrationTest {

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
        registry.add("GITHUB_CLIENT_ID", () -> "test-github-client-id");
        registry.add("GITHUB_CLIENT_SECRET", () -> "test-github-client-secret");
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired UserAccounts accounts;
    @Autowired OAuthLoginService oauth;
    @Autowired OAuthLoginHandlers handlers;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;

    @Test
    void authorizationRedirectGoesToGitHubWithStatePkceAndEmailScope() throws Exception {
        String location = mvc.perform(get("/api/v1/auth/oauth2/authorization/github"))
                .andExpect(status().is3xxRedirection()).andReturn().getResponse().getHeader("Location");
        assertEquals("github.com", URI.create(location).getHost());
        assertTrue(location.contains("state="));
        assertTrue(location.contains("code_challenge="));
        assertTrue(location.contains("code_challenge_method=S256"));
        assertTrue(location.contains("user:email"));
        assertTrue(location.contains("redirect_uri=http://localhost/api/v1/auth/oauth2/callback/github"));
        assertFalse(location.contains("test-github-client-secret"));
    }

    @Test
    void googleAndUnknownProvidersStayDeniedWhenOnlyGitHubIsConfigured() throws Exception {
        mvc.perform(get("/api/v1/auth/oauth2/authorization/google")).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/auth/oauth2/authorization/gitlab")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/oauth2/authorization/github")).andExpect(status().isForbidden());
    }

    @Test
    void callbackWithoutAStoredRequestRedirectsToFrontendWithAProviderError() throws Exception {
        mvc.perform(get("/api/v1/auth/oauth2/callback/github").param("code", "x").param("state", "y"))
                .andExpect(status().is3xxRedirection())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Location", "http://localhost:3000/login?oauth_error=provider_error"));
    }

    @Test
    void newGitHubUserIsOnboardedThroughTheHandler() throws Exception {
        String id = numericId();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession());
        MockHttpServletResponse response = new MockHttpServletResponse();

        handlers.success(request, response, githubToken(id, id + "@example.test", true));

        assertEquals("http://localhost:3000/", response.getRedirectedUrl());
        List<String> cookies = response.getHeaders(HttpHeaders.SET_COOKIE);
        assertTrue(cookies.stream().anyMatch(value -> value.startsWith("PDA_ACCESS=") && value.contains("HttpOnly")));
        assertTrue(cookies.stream().anyMatch(value -> value.startsWith("PDA_REFRESH=") && value.contains("HttpOnly")));
        UUID userId = accounts.findActiveByOAuthIdentity(OAuthProvider.GITHUB, id).orElseThrow().id();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ? AND password_hash IS NULL",
                Integer.class, userId));
    }

    @Test
    void gitHubWithoutAVerifiedPrimaryEmailIsRejected() throws Exception {
        String id = numericId();
        MockHttpServletResponse response = new MockHttpServletResponse();

        handlers.success(new MockHttpServletRequest(), response, githubToken(id, null, false));

        assertEquals("http://localhost:3000/login?oauth_error=email_not_verified", response.getRedirectedUrl());
        assertTrue(response.getHeaders(HttpHeaders.SET_COOKIE).isEmpty());
        assertTrue(accounts.findActiveByOAuthIdentity(OAuthProvider.GITHUB, id).isEmpty());
    }

    @Test
    void existingLocalEmailIsNeverMergedAutomatically() {
        User local = newLocalUser();
        String id = numericId();
        OAuthLoginException failure = assertThrows(OAuthLoginException.class,
                () -> oauth.login(profile(id, local.getEmail(), true), null));
        assertEquals(FailureReason.ACCOUNT_EXISTS, failure.reason());
        assertTrue(accounts.findActiveByOAuthIdentity(OAuthProvider.GITHUB, id).isEmpty());
    }

    @Test
    void linkingRulesAndUnlinkWorkForGitHub() {
        User first = newLocalUser();
        User second = newLocalUser();
        String id = numericId();

        assertEquals(LinkOutcome.LINKED, oauth.link(first.getId(), profile(id, "a@example.test", true)));
        assertEquals(LinkOutcome.ALREADY_LINKED, oauth.link(first.getId(), profile(id, "a@example.test", true)));
        assertEquals(LinkOutcome.IDENTITY_USED_BY_OTHER_ACCOUNT,
                oauth.link(second.getId(), profile(id, "a@example.test", true)));
        assertEquals(LinkOutcome.PROVIDER_HAS_OTHER_IDENTITY,
                oauth.link(first.getId(), profile(numericId(), "b@example.test", true)));

        assertEquals(UnlinkOutcome.UNLINKED, accounts.unlinkOAuth(first.getId(), OAuthProvider.GITHUB));
        assertEquals(UnlinkOutcome.NOT_LINKED, accounts.unlinkOAuth(first.getId(), OAuthProvider.GITHUB));
    }

    @Test
    void linkHandlerReportsLinkedToAnotherAccount() throws Exception {
        User owner = newLocalUser();
        User other = newLocalUser();
        String id = numericId();
        oauth.link(owner.getId(), profile(id, "o@example.test", true));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(LinkAwareAuthorizationRequestRepository.REQUEST_LINK_USER, other.getId().toString());
        MockHttpServletResponse response = new MockHttpServletResponse();
        handlers.success(request, response, githubToken(id, "o@example.test", true));

        assertEquals("http://localhost:3000/?oauth_link=linked_to_another_account", response.getRedirectedUrl());
        assertTrue(response.getHeaders(HttpHeaders.SET_COOKIE).isEmpty());
    }

    @Test
    void genericLinkEndpointsHandleGitHubAndRejectUnknownProviders() throws Exception {
        User user = newLocalUser();
        Cookie csrf = mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(csrf);
        Cookie access = loginCookie(user, csrf);

        mvc.perform(post("/api/v1/auth/oauth/github/link").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        String body = mvc.perform(post("/api/v1/auth/oauth/github/link").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(body.contains("/api/v1/auth/oauth2/authorization/github?intent=link"));

        // Google is not configured in this context; gitlab is not a provider at all.
        mvc.perform(post("/api/v1/auth/oauth/google/link").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/auth/oauth/gitlab/link").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/auth/oauth/gitlab/unlink").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/auth/oauth/github/unlink").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNotFound());
    }

    private Cookie loginCookie(User user, Cookie csrf) throws Exception {
        String password = "pw-" + UUID.randomUUID();
        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?", encoder.encode(password), user.getId());
        var headers = mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType("application/json")
                        .content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getHeaders(HttpHeaders.SET_COOKIE);
        String value = headers.stream().filter(header -> header.startsWith("PDA_ACCESS="))
                .findFirst().orElseThrow().split(";", 2)[0].substring("PDA_ACCESS=".length());
        return new Cookie("PDA_ACCESS", value);
    }

    private User newLocalUser() {
        return users.saveAndFlush(User.registerLocalActive(UUID.randomUUID() + "@example.test",
                "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 20),
                UUID.randomUUID().toString(), encoder));
    }

    private static String numericId() {
        return String.valueOf(Math.abs(UUID.randomUUID().getMostSignificantBits()));
    }

    private static Profile profile(String subject, String email, boolean verified) {
        return new Profile(OAuthProvider.GITHUB, subject, email, verified, "octocat");
    }

    private static OAuth2AuthenticationToken githubToken(String id, String email, boolean verified) {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put("id", Long.parseLong(id));
        attributes.put("login", "octocat");
        attributes.put("email", email);
        attributes.put("email_verified", verified);
        DefaultOAuth2User principal = new DefaultOAuth2User(AuthorityUtils.createAuthorityList("OAUTH2_USER"),
                attributes, "id");
        return new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "github");
    }
}
