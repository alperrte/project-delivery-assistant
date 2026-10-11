package com.pda.admin.integration;

import com.pda.auth.application.service.JwtTokens;
import com.pda.user.UserSessions;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;

/**
 * Test-only shortcut for the tests of the administrator API itself: a session exactly as the administrator sign-in leaves
 * it (administrator-verified), without repeating the password and authenticator steps in every test. Administrators
 * cannot use the regular login any more. The real sign-in is covered by
 * {@code com.pda.auth.integration.AdminAuthIntegrationTest}; never use this class to test that flow.
 */
final class AdminSessionFactory {

    private AdminSessionFactory() {
    }

    /** {access, refresh} cookies of an administrator-verified session. */
    static Cookie[] verified(UserSessions sessions, JwtTokens tokens, UUID adminId) {
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(adminId);
        UUID sessionId = sessions.openAdminVerified(adminId, refresh.value(), refresh.expiresAt(), "test-admin-factory",
                Instant.now());
        JwtTokens.IssuedToken access = tokens.issueAccess(adminId, sessionId);
        return new Cookie[] {new Cookie("PDA_ACCESS", access.value()), new Cookie("PDA_REFRESH", refresh.value())};
    }

    /** {access, refresh} cookies of a session that carries no administrator mark (every session before the change). */
    static Cookie[] unmarked(UserSessions sessions, JwtTokens tokens, UUID userId) {
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(userId);
        UUID sessionId = sessions.open(userId, refresh.value(), refresh.expiresAt(), "test-unmarked");
        JwtTokens.IssuedToken access = tokens.issueAccess(userId, sessionId);
        return new Cookie[] {new Cookie("PDA_ACCESS", access.value()), new Cookie("PDA_REFRESH", refresh.value())};
    }
}
