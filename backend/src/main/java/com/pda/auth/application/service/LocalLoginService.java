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
    private final TotpService twoFactor;

    public LocalLoginService(UserAccounts users, UserSessions sessions, JwtTokens tokens, Clock clock,
                             TotpService twoFactor) {
        this.users = users;
        this.sessions = sessions;
        this.tokens = tokens;
        this.clock = clock;
        this.twoFactor = twoFactor;
    }

    /** The password was right: either a session, or (two-factor is on) the account that still owes its second step. */
    @Transactional
    public LoginResult login(String email, String password, String userAgent) {
        UserAccounts.AuthenticatedUser user = users.authenticateLocal(email, password).orElseThrow(() ->
                users.matchesPendingLocal(email, password) ? new EmailNotVerifiedException() : new InvalidCredentialsException());
        return afterFirstFactor(user.id(), userAgent);
    }

    /** Shared by every first factor (password, Google, GitHub): a session unless the account asks for a second one. */
    @Transactional
    public LoginResult afterFirstFactor(UUID userId, String userAgent) {
        if (twoFactor.isEnabled(userId)) {
            return LoginResult.secondFactorRequired(userId);
        }
        return LoginResult.signedIn(openSession(userId, userAgent));
    }

    /** The second step of a sign-in: the authenticator (or backup) code. A wrong code leaves no session behind. */
    @Transactional
    public SecondFactorResult completeSecondFactor(UUID userId, String code, String userAgent) {
        if (users.findActiveById(userId).isEmpty()) {
            return new SecondFactorResult(TotpService.Result.INVALID, null);
        }
        TotpService.Result result = twoFactor.verify(userId, code);
        return new SecondFactorResult(result, result == TotpService.Result.OK ? openSession(userId, userAgent) : null);
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

    private LoginTokens openSession(UUID userId, String userAgent) {
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(userId);
        UUID sessionId = sessions.open(userId, refresh.value(), refresh.expiresAt(), userAgent);
        JwtTokens.IssuedToken access = tokens.issueAccess(userId, sessionId);
        return new LoginTokens(access.value(), refresh.value());
    }

    public record LoginTokens(String access, String refresh) {}

    /** Exactly one of the two is set. */
    public record LoginResult(LoginTokens tokens, UUID secondFactorUserId) {
        static LoginResult signedIn(LoginTokens tokens) {
            return new LoginResult(tokens, null);
        }

        static LoginResult secondFactorRequired(UUID userId) {
            return new LoginResult(null, userId);
        }

        public boolean needsSecondFactor() {
            return secondFactorUserId != null;
        }
    }

    public record SecondFactorResult(TotpService.Result result, LoginTokens tokens) {}
}
