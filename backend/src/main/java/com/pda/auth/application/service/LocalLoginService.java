package com.pda.auth.application.service;

import com.pda.user.UserAccounts;
import com.pda.user.UserSessions;
import java.time.Clock;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LocalLoginService {

    private static final Logger log = LoggerFactory.getLogger(LocalLoginService.class);

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

    /**
     * The password was right: either a session, or (two-factor is on) the account that still owes its second step.
     * An administrator account is answered exactly like a wrong password: administrators sign in only through the
     * separate administrator sign-in (see {@link AdminAuthService}).
     */
    @Transactional
    public LoginResult login(String email, String password, String userAgent) {
        UserAccounts.AuthenticatedUser user = users.authenticateLocal(email, password).orElseThrow(() ->
                users.matchesPendingLocal(email, password) ? new EmailNotVerifiedException() : new InvalidCredentialsException());
        return afterFirstFactor(user.id(), userAgent);
    }

    /**
     * Shared by every first factor (password, Google, GitHub): a session unless the account asks for a second one.
     * Never for an administrator: that account cannot sign in on this path at all.
     */
    @Transactional
    public LoginResult afterFirstFactor(UUID userId, String userAgent) {
        if (users.isAdministrator(userId)) {
            log.warn("Administrator sign-in refused on the regular sign-in path. userId={}", userId);
            throw new InvalidCredentialsException();
        }
        if (twoFactor.isEnabled(userId)) {
            return LoginResult.secondFactorRequired(userId);
        }
        return LoginResult.signedIn(openSession(userId, userAgent, false));
    }

    /** The second step of a sign-in: the authenticator (or backup) code. A wrong code leaves no session behind. */
    @Transactional
    public SecondFactorResult completeSecondFactor(UUID userId, String code, String userAgent) {
        if (users.findActiveById(userId).isEmpty() || users.isAdministrator(userId)) {
            return new SecondFactorResult(TotpService.Result.INVALID, null);
        }
        TotpService.Result result = twoFactor.verify(userId, code);
        return new SecondFactorResult(result, result == TotpService.Result.OK ? openSession(userId, userAgent, false) : null);
    }

    /**
     * A session that carries the administrator-verified mark. Reserved for {@link AdminAuthService}, which calls it
     * only after the password and a current authenticator code (or the first-time enrolment code) were proven.
     */
    @Transactional
    public LoginTokens openAdminSession(UUID userId, String userAgent) {
        return openSession(userId, userAgent, true);
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

    private LoginTokens openSession(UUID userId, String userAgent, boolean adminVerified) {
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(userId);
        UUID sessionId = adminVerified
                ? sessions.openAdminVerified(userId, refresh.value(), refresh.expiresAt(), userAgent, clock.instant())
                : sessions.open(userId, refresh.value(), refresh.expiresAt(), userAgent);
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
