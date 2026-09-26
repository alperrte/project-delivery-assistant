package com.pda.auth.application.service;

import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.time.Clock;
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
    public LoginTokens login(String email, String password) {
        UserAccounts.AuthenticatedUser user = users.authenticateLocal(email, password)
                .orElseThrow(InvalidCredentialsException::new);
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(user.id());
        var sessionId = sessions.open(user.id(), refresh.value(), refresh.expiresAt());
        JwtTokens.IssuedToken access = tokens.issueAccess(user.id(), sessionId);
        return new LoginTokens(access.value(), refresh.value());
    }

    @Transactional
    public void logout(String refreshToken) {
        tokens.parseRefresh(refreshToken).ifPresent(userId ->
                sessions.revoke(userId, refreshToken, clock.instant()));
    }

    public record LoginTokens(String access, String refresh) {}
}
