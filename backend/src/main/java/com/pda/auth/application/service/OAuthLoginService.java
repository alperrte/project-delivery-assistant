package com.pda.auth.application.service;

import com.pda.auth.application.service.LocalLoginService.LoginTokens;
import com.pda.user.OAuthProvider;
import com.pda.user.UserAccounts;
import com.pda.user.UserAccounts.LinkOutcome;
import com.pda.user.UserRegistrationConflictException;
import com.pda.user.UserSessions;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns a provider-verified identity into a PDA session. Provider tokens are never stored or forwarded: the
 * result is an ordinary PDA access/refresh pair backed by a UserSession, exactly like a local login.
 */
@Service
public class OAuthLoginService {

    private final UserAccounts users;
    private final UserSessions sessions;
    private final JwtTokens tokens;

    public OAuthLoginService(UserAccounts users, UserSessions sessions, JwtTokens tokens) {
        this.users = users;
        this.sessions = sessions;
        this.tokens = tokens;
    }

    /** Provider claims after the OIDC library validated signature, issuer, audience, expiry and nonce. */
    public record Profile(OAuthProvider provider, String subject, String email, boolean emailVerified,
                          String displayName) {}

    public enum FailureReason {
        EMAIL_NOT_VERIFIED("email_not_verified"),
        ACCOUNT_EXISTS("account_exists"),
        PROVIDER_ERROR("provider_error");

        private final String code;

        FailureReason(String code) {
            this.code = code;
        }

        public String code() {
            return code;
        }
    }

    public static final class OAuthLoginException extends RuntimeException {
        private final FailureReason reason;

        public OAuthLoginException(FailureReason reason) {
            super(reason.code());
            this.reason = reason;
        }

        public FailureReason reason() {
            return reason;
        }
    }

    @Transactional
    public LoginTokens login(Profile profile, String userAgent) {
        if (profile.subject() == null || profile.subject().isBlank()) {
            throw new OAuthLoginException(FailureReason.PROVIDER_ERROR);
        }
        UUID userId = users.findActiveByOAuthIdentity(profile.provider(), profile.subject())
                .map(UserAccounts.AuthenticatedUser::id)
                .orElseGet(() -> onboard(profile));
        JwtTokens.IssuedToken refresh = tokens.issueRefresh(userId);
        UUID sessionId = sessions.open(userId, refresh.value(), refresh.expiresAt(), userAgent);
        JwtTokens.IssuedToken access = tokens.issueAccess(userId, sessionId);
        return new LoginTokens(access.value(), refresh.value());
    }

    /** Connects the provider identity to an already authenticated user. Never creates or merges accounts. */
    @Transactional
    public LinkOutcome link(UUID userId, Profile profile) {
        if (profile.subject() == null || profile.subject().isBlank()) {
            throw new OAuthLoginException(FailureReason.PROVIDER_ERROR);
        }
        return users.linkOAuth(userId, profile.provider(), profile.subject(), profile.email());
    }

    private UUID onboard(Profile profile) {
        if (!profile.emailVerified() || profile.email() == null || profile.email().isBlank()) {
            throw new OAuthLoginException(FailureReason.EMAIL_NOT_VERIFIED);
        }
        try {
            return users.registerOAuth(profile.provider(), profile.subject(), profile.email(),
                    profile.displayName());
        } catch (UserRegistrationConflictException exception) {
            // The email already belongs to another account: never merge automatically.
            throw new OAuthLoginException(FailureReason.ACCOUNT_EXISTS);
        }
    }
}
