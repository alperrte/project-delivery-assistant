package com.pda.shared.testing;

import com.pda.auth.application.service.JwtTokens;
import com.pda.user.UserSessions;
import jakarta.servlet.http.Cookie;
import java.util.UUID;

/**
 * Prepares a fresh, real non-admin session for chat fixtures. Registration still
 * uses UserAccounts and normal BCrypt; password/login tests remain in auth.
 * Requests and websocket handshakes still pass the real JWT/session checks.
 */
public final class RegularSessionFactory {
    private RegularSessionFactory() {}

    public static Cookie access(UserSessions sessions, JwtTokens tokens, UUID userId) {
        var refresh = tokens.issueRefresh(userId);
        UUID sessionId = sessions.open(userId, refresh.value(), refresh.expiresAt(), "test-chat-fixture");
        return new Cookie("PDA_ACCESS", tokens.issueAccess(userId, sessionId).value());
    }
}
