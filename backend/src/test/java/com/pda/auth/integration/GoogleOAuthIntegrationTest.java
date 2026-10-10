package com.pda.auth.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.pda.BackendApplication;
import com.pda.auth.application.service.LocalLoginService.LoginTokens;
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
import java.time.Instant;
import java.util.Base64;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Google login with a configured (fake-credential) provider; the provider itself is never contacted. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class GoogleOAuthIntegrationTest {

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
        registry.add("GOOGLE_CLIENT_ID", () -> "test-client-id.apps.googleusercontent.com");
        registry.add("GOOGLE_CLIENT_SECRET", () -> "test-client-secret");
    }

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired UserAccounts accounts;
    @Autowired OAuthLoginService oauth;
    @Autowired OAuthLoginHandlers handlers;
    @Autowired JdbcTemplate jdbc;
    @Autowired BCryptPasswordEncoder encoder;

    @Test
    void authorizationRedirectGoesToGoogleWithStateNonceAndPkce() throws Exception {
        String location = mvc.perform(get("/api/v1/auth/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection()).andReturn().getResponse().getHeader("Location");
        URI uri = URI.create(location);
        assertEquals("accounts.google.com", uri.getHost());
        assertTrue(location.contains("response_type=code"));
        assertTrue(location.contains("state="));
        assertTrue(location.contains("nonce="));
        assertTrue(location.contains("code_challenge="));
        assertTrue(location.contains("code_challenge_method=S256"));
        assertTrue(location.contains("scope=openid"));
        assertTrue(location.contains("redirect_uri=http://localhost/api/v1/auth/oauth2/callback/google"));
        assertFalse(location.contains("test-client-secret"));
    }

    @Test
    void callbackWithoutAStoredRequestRedirectsToFrontendWithAProviderError() throws Exception {
        mvc.perform(get("/api/v1/auth/oauth2/callback/google").param("code", "x").param("state", "y"))
                .andExpect(status().is3xxRedirection())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Location", "http://localhost:3000/login?oauth_error=provider_error"));
    }

    @Test
    void unknownProviderAndOtherMethodsStayDenied() throws Exception {
        mvc.perform(get("/api/v1/auth/oauth2/authorization/github")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/auth/oauth2/authorization/google")).andExpect(status().isForbidden());
        mvc.perform(get("/login")).andExpect(status().isForbidden());
    }

    @Test
    void newVerifiedGoogleUserIsOnboardedWithASessionAndNoPassword() {
        String subject = subject();
        String email = subject + "@example.test";
        LoginTokens tokens = oauth.login(profile(subject, email, true, "Ada Lovelace"), "Chrome/1.0").tokens();
        assertNotNull(tokens.access());
        assertNotNull(tokens.refresh());
        UUID userId = accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).orElseThrow().id();
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?",
                Integer.class, userId));
        assertEquals("Chrome/1.0", jdbc.queryForObject("SELECT user_agent FROM user_sessions WHERE user_id = ?",
                String.class, userId));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ? AND password_hash IS NULL"
                + " AND account_status = 'ACTIVE' AND global_role = 'USER'", Integer.class, userId));
    }

    @Test
    void returningGoogleUserReusesTheAccountEvenIfTheEmailChanged() {
        String subject = subject();
        oauth.login(profile(subject, subject + "@example.test", true, "Grace"), null);
        UUID first = accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).orElseThrow().id();
        oauth.login(profile(subject, "renamed-" + subject + "@example.test", true, "Grace"), null);
        assertEquals(first, accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).orElseThrow().id());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?",
                Integer.class, first));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM users WHERE email LIKE ?", Integer.class,
                "%" + subject + "@example.test"));
    }

    @Test
    void existingLocalEmailIsNeverMergedAutomatically() {
        User local = newLocalUser();
        String subject = subject();
        OAuthLoginException failure = assertThrows(OAuthLoginException.class,
                () -> oauth.login(profile(subject, local.getEmail().toUpperCase(), true, "Mallory"), null));
        assertEquals(FailureReason.ACCOUNT_EXISTS, failure.reason());
        assertTrue(accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).isEmpty());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM user_sessions WHERE user_id = ?",
                Integer.class, local.getId()));
    }

    @Test
    void unverifiedProviderEmailIsRejected() {
        String subject = subject();
        OAuthLoginException failure = assertThrows(OAuthLoginException.class,
                () -> oauth.login(profile(subject, subject + "@example.test", false, "Eve"), null));
        assertEquals(FailureReason.EMAIL_NOT_VERIFIED, failure.reason());
        assertTrue(accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).isEmpty());
    }

    @Test
    void linkingRulesAreEnforced() {
        User first = newLocalUser();
        User second = newLocalUser();
        String subject = subject();
        String otherSubject = subject();

        assertEquals(LinkOutcome.LINKED, oauth.link(first.getId(), profile(subject, "a@example.test", true, "A")));
        assertEquals(LinkOutcome.ALREADY_LINKED, oauth.link(first.getId(), profile(subject, "a@example.test", true, "A")));
        assertEquals(LinkOutcome.IDENTITY_USED_BY_OTHER_ACCOUNT,
                oauth.link(second.getId(), profile(subject, "a@example.test", true, "A")));
        assertEquals(LinkOutcome.PROVIDER_HAS_OTHER_IDENTITY,
                oauth.link(first.getId(), profile(otherSubject, "b@example.test", true, "B")));
        assertEquals(LinkOutcome.ACCOUNT_UNAVAILABLE,
                oauth.link(UUID.randomUUID(), profile(otherSubject, "b@example.test", true, "B")));
        assertEquals(first.getId(), accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).orElseThrow().id());
    }

    @Test
    void unlinkIsRefusedForTheLastLoginMethodButAllowedWithAPassword() {
        String subject = subject();
        oauth.login(profile(subject, subject + "@example.test", true, "Only Google"), null);
        UUID googleOnly = accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).orElseThrow().id();
        assertEquals(UnlinkOutcome.LAST_LOGIN_METHOD, accounts.unlinkOAuth(googleOnly, OAuthProvider.GOOGLE));
        assertEquals(1, accounts.listOAuthIdentities(googleOnly).size());

        User withPassword = newLocalUser();
        assertEquals(UnlinkOutcome.NOT_LINKED, accounts.unlinkOAuth(withPassword.getId(), OAuthProvider.GOOGLE));
        oauth.link(withPassword.getId(), profile(subject(), "c@example.test", true, "C"));
        assertEquals(UnlinkOutcome.UNLINKED, accounts.unlinkOAuth(withPassword.getId(), OAuthProvider.GOOGLE));
        assertTrue(accounts.listOAuthIdentities(withPassword.getId()).isEmpty());
    }

    @Test
    void successHandlerIssuesPdaCookiesAndRedirectsToTheFrontendOnly() throws Exception {
        String subject = subject();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession());
        request.addHeader("User-Agent", "HandlerTest/1.0");
        MockHttpServletResponse response = new MockHttpServletResponse();

        handlers.success(request, response, googleToken(subject, subject + "@example.test", true));

        assertEquals("http://localhost:3000/projects", response.getRedirectedUrl());
        List<String> cookies = response.getHeaders(HttpHeaders.SET_COOKIE);
        assertTrue(cookies.stream().anyMatch(value -> value.startsWith("PDA_ACCESS=") && value.contains("HttpOnly")));
        assertTrue(cookies.stream().anyMatch(value -> value.startsWith("PDA_REFRESH=") && value.contains("HttpOnly")));
        String access = cookies.stream().filter(value -> value.startsWith("PDA_ACCESS="))
                .findFirst().orElseThrow().split(";", 2)[0].substring("PDA_ACCESS=".length());
        mvc.perform(get("/api/v1/auth/me").cookie(new Cookie("PDA_ACCESS", access)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(subject + "@example.test"));
        assertTrue(request.getSession(false) == null || ((MockHttpSession) request.getSession(false)).isInvalid());
        assertEquals("no-store", response.getHeader("Cache-Control"));
    }

    @Test
    void successHandlerInLinkModeLinksWithoutIssuingCookies() throws Exception {
        User user = newLocalUser();
        String subject = subject();
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setSession(new MockHttpSession());
        request.setAttribute(LinkAwareAuthorizationRequestRepository.REQUEST_LINK_USER, user.getId().toString());
        MockHttpServletResponse response = new MockHttpServletResponse();

        handlers.success(request, response, googleToken(subject, "link-" + subject + "@example.test", true));

        assertEquals("http://localhost:3000/?oauth_link=linked", response.getRedirectedUrl());
        assertTrue(response.getHeaders(HttpHeaders.SET_COOKIE).isEmpty());
        assertEquals(user.getId(), accounts.findActiveByOAuthIdentity(OAuthProvider.GOOGLE, subject).orElseThrow().id());
    }

    @Test
    void successHandlerReportsCollisionsWithoutCookies() throws Exception {
        User local = newLocalUser();
        MockHttpServletResponse response = new MockHttpServletResponse();

        handlers.success(new MockHttpServletRequest(), response, googleToken(subject(), local.getEmail(), true));

        assertEquals("http://localhost:3000/login?oauth_error=account_exists", response.getRedirectedUrl());
        assertTrue(response.getHeaders(HttpHeaders.SET_COOKIE).isEmpty());
    }

    @Test
    void failureHandlerMapsOnlyAccessDeniedAndHidesProviderDetails() throws Exception {
        MockHttpServletResponse denied = new MockHttpServletResponse();
        handlers.failure(new MockHttpServletRequest(), denied,
                new OAuth2AuthenticationException(new org.springframework.security.oauth2.core.OAuth2Error("access_denied")));
        assertEquals("http://localhost:3000/login?oauth_error=access_denied", denied.getRedirectedUrl());

        MockHttpServletResponse other = new MockHttpServletResponse();
        handlers.failure(new MockHttpServletRequest(), other,
                new OAuth2AuthenticationException(new org.springframework.security.oauth2.core.OAuth2Error("secret_detail")));
        assertEquals("http://localhost:3000/login?oauth_error=provider_error", other.getRedirectedUrl());
    }

    @Test
    void linkEndpointsRequireAuthenticationAndCsrfAndBindLinkToTheSession() throws Exception {
        User user = newLocalUser();
        Cookie csrf = mvc.perform(get("/api/v1/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(csrf);
        Cookie access = loginCookie(user, csrf);

        mvc.perform(get("/api/v1/auth/oauth/identities")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/oauth/google/link").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/oauth/google/link").cookie(access)).andExpect(status().isForbidden());

        MockHttpSession session = new MockHttpSession();
        String url = com.jayway.jsonpath.JsonPath.read(mvc.perform(post("/api/v1/auth/oauth/google/link")
                        .session(session).cookie(csrf, access).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.authorizationUrl");
        assertTrue(url.endsWith("/api/v1/auth/oauth2/authorization/google?intent=link"));

        // Starting login (no intent) must not consume or honour the link intent.
        mvc.perform(get("/api/v1/auth/oauth2/authorization/google").session(session))
                .andExpect(status().is3xxRedirection());
        assertNotNull(session.getAttribute(LinkAwareAuthorizationRequestRepository.SESSION_LINK_USER));

        mvc.perform(get(url).session(session)).andExpect(status().is3xxRedirection());
        assertEquals(null, session.getAttribute(LinkAwareAuthorizationRequestRepository.SESSION_LINK_USER));

        mvc.perform(get("/api/v1/auth/oauth/identities").cookie(access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(post("/api/v1/auth/oauth/google/unlink").cookie(csrf, access)
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
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

    private static String subject() {
        return "g" + UUID.randomUUID().toString().replace("-", "");
    }

    private static Profile profile(String subject, String email, boolean verified, String name) {
        return new Profile(OAuthProvider.GOOGLE, subject, email, verified, name);
    }

    private static OAuth2AuthenticationToken googleToken(String subject, String email, boolean verified) {
        OidcIdToken idToken = new OidcIdToken("token-value", Instant.now(), Instant.now().plusSeconds(60),
                Map.of("sub", subject, "email", email, "email_verified", verified, "name", "Test User"));
        DefaultOidcUser principal = new DefaultOidcUser(AuthorityUtils.createAuthorityList("OIDC_USER"), idToken);
        return new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google");
    }
}
