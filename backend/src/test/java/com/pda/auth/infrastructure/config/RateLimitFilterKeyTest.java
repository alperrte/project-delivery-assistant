package com.pda.auth.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * The limiters count requests per route and client address. A key built from the raw URI would let one
 * unauthenticated client fill the table with made-up paths (and lock everybody else out), or dodge the limit
 * by changing an id in the path.
 */
class RateLimitFilterKeyTest {

    private static int status(jakarta.servlet.Filter filter, String method, String uri, String address) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, uri);
        request.setRemoteAddr(address);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    void madeUpOAuthPathsFromOneClientNeitherFillTheTableNorLockOthersOut() throws Exception {
        AuthRateLimitFilter filter = new AuthRateLimitFilter();
        for (int i = 0; i < 10_500; i++) {
            status(filter, "GET", "/api/v1/auth/oauth2/authorization/made-up-" + i, "198.51.100.1");
        }
        // The flood is answered with 429 for the flooder only; everyone else is still served.
        assertEquals(429, status(filter, "GET", "/api/v1/auth/oauth2/authorization/another", "198.51.100.1"));
        assertEquals(200, status(filter, "POST", "/api/v1/auth/login", "198.51.100.2"));
        assertEquals(200, status(filter, "GET", "/api/v1/auth/oauth2/authorization/google", "198.51.100.3"));
    }

    @Test
    void theAuthLimitsDefaultToTheProductionValuesAndCanBeRaisedForTestEnvironments() throws Exception {
        // Nothing configured: 5 registrations per address, then 429.
        AuthRateLimitFilter production = AuthRateLimitFilter.configured(new MockEnvironment());
        for (int i = 0; i < 5; i++) {
            assertEquals(200, status(production, "POST", "/api/v1/auth/register", "198.51.100.40"));
        }
        assertEquals(429, status(production, "POST", "/api/v1/auth/register", "198.51.100.40"));
        // Login keeps its own, larger default.
        for (int i = 0; i < 30; i++) {
            assertEquals(200, status(production, "POST", "/api/v1/auth/login", "198.51.100.40"));
        }
        assertEquals(429, status(production, "POST", "/api/v1/auth/login", "198.51.100.40"));

        // A test environment raises the registration limit; the other two keep their defaults.
        AuthRateLimitFilter relaxed = AuthRateLimitFilter.configured(
                new MockEnvironment().withProperty("auth.rate-limit.sensitive-max-requests", "50"));
        for (int i = 0; i < 50; i++) {
            assertEquals(200, status(relaxed, "POST", "/api/v1/auth/register", "198.51.100.41"));
        }
        assertEquals(429, status(relaxed, "POST", "/api/v1/auth/register", "198.51.100.41"));
        for (int i = 0; i < 30; i++) {
            assertEquals(200, status(relaxed, "POST", "/api/v1/auth/login", "198.51.100.41"));
        }
        assertEquals(429, status(relaxed, "POST", "/api/v1/auth/login", "198.51.100.41"));

        // A nonsensical value fails the start instead of silently disabling the protection.
        assertThrows(IllegalStateException.class, () -> AuthRateLimitFilter.configured(
                new MockEnvironment().withProperty("auth.rate-limit.sensitive-max-requests", "0")));
    }

    @Test
    void theAdministratorSignInEndpointsUseTheStrictBucketPerRouteWhileTheRegularLoginKeepsItsOwn() throws Exception {
        AuthRateLimitFilter filter = AuthRateLimitFilter.configured(new MockEnvironment());
        for (String path : new String[] {"/api/v1/auth/admin/login", "/api/v1/auth/admin/login/2fa",
                "/api/v1/auth/admin/2fa/setup", "/api/v1/auth/admin/2fa/enable"}) {
            for (int i = 0; i < 5; i++) {
                assertEquals(200, status(filter, "POST", path, "198.51.100.60"), path);
            }
            assertEquals(429, status(filter, "POST", path, "198.51.100.60"), path);
            assertEquals(200, status(filter, "POST", path, "198.51.100.61"), path);
        }
        // Exhausting the administrator routes does not touch the regular login bucket of the same address.
        assertEquals(200, status(filter, "POST", "/api/v1/auth/login", "198.51.100.60"));
        // Only POST is limited; the routes do not exist for other methods.
        assertEquals(200, status(filter, "GET", "/api/v1/auth/admin/login", "198.51.100.60"));
    }

    @Test
    void varyingTheIdInAnInvitationPathCannotMintEndlessKeysOrLockOthersOut() throws Exception {
        ProjectInvitationRateLimitFilter filter = new ProjectInvitationRateLimitFilter();
        // The same invitation is limited per URI, as before.
        String same = "/api/v1/projects/" + UUID.randomUUID() + "/invitations/" + UUID.randomUUID() + "/accept";
        for (int i = 0; i < 10; i++) {
            assertEquals(200, status(filter, "POST", same, "198.51.100.10"));
        }
        assertEquals(429, status(filter, "POST", same, "198.51.100.10"));
        // A flood of made-up URIs from one client stops at the per-client total, long before the table is full ...
        int served = 0;
        for (int i = 0; i < 12_000; i++) {
            String made = "/api/v1/projects/" + UUID.randomUUID() + "/invitations/" + UUID.randomUUID() + "/reject";
            if (status(filter, "POST", made, "198.51.100.12") == 200) served++;
        }
        assertEquals(200, served);
        // ... so everybody else is still served.
        assertEquals(200, status(filter, "POST", same, "198.51.100.13"));
        assertEquals(200, status(filter, "POST", "/api/v1/projects/" + UUID.randomUUID() + "/invitations", "198.51.100.14"));
    }
}
