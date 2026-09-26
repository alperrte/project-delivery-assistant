package com.pda.auth.application.service;

import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LocalLoginService {

    private final UserAccounts users;
    private final UserSessions sessions;
    private final JwtTokens tokens;
    private final Clock clock;

    public LocalLoginService(UserAccounts users, UserSessions sessions, JwtTokens tokens, Clock clock) {
        this.users = users;
        this.sessions = sessions;
        this.tokens = tokens;
        this.clock = clock;
    }

    @Transactional
    public LoginTokens login(String email, String password, String userAgent) {
        UserAccounts.AuthenticatedUser user = users.authenticateLocal(email, password)
                .orElseThrow(InvalidCredentialsException::new);
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(user.id());
        var sessionId = sessions.open(user.id(), refresh.value(), refresh.expiresAt(), userAgent);
        JwtTokens.IssuedToken access = tokens.issueAccess(user.id(), sessionId);
        return new LoginTokens(access.value(), refresh.value());
    }

    // Replay detection revokes the session inside rotate(); that revocation must survive the 401 path.
    @Transactional(noRollbackFor = InvalidRefreshTokenException.class)
    public LoginTokens refresh(String refreshToken) {
        UUID userId = tokens.parseRefresh(refreshToken).orElseThrow(InvalidRefreshTokenException::new);
        users.findActiveById(userId).orElseThrow(InvalidRefreshTokenException::new);
        JwtTokens.IssuedToken nextRefresh = tokens.issueRefresh(userId);
        UUID sessionId = sessions.rotate(userId, refreshToken, nextRefresh.value(),
                        nextRefresh.expiresAt(), clock.instant())
                .orElseThrow(InvalidRefreshTokenException::new);
        JwtTokens.IssuedToken access = tokens.issueAccess(userId, sessionId);
        return new LoginTokens(access.value(), nextRefresh.value());
    }

    @Transactional
    public void logout(String refreshToken) {
        tokens.parseRefresh(refreshToken).ifPresent(userId ->
                sessions.revoke(userId, refreshToken, clock.instant()));
    }

    public record LoginTokens(String access, String refresh) {}
}
