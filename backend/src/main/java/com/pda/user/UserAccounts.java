package com.pda.user;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Public User module contract for Auth use cases. */
public interface UserAccounts {
    UUID registerLocal(String email, String nickname, String rawPassword);
    Optional<UUID> findPendingByEmail(String email);
    boolean activateVerifiedEmail(UUID userId);
    Optional<AuthenticatedUser> authenticateLocal(String email, String password);
    Optional<AuthenticatedUser> findActiveById(UUID userId);

    /** ACTIVE user connected to this provider identity; empty when unknown or the account is not active. */
    Optional<AuthenticatedUser> findActiveByOAuthIdentity(OAuthProvider provider, String subject);

    /**
     * Creates a passwordless ACTIVE account with a verified email and connects the identity. Never merges into
     * an existing account: throws {@link UserRegistrationConflictException} when the email is already registered
     * (compared case-insensitively) or the identity is already connected.
     */
    UUID registerOAuth(OAuthProvider provider, String subject, String email, String displayName);

    LinkOutcome linkOAuth(UUID userId, OAuthProvider provider, String subject, String providerEmail);

    /** Disconnects a provider only while the user keeps another way to sign in (a password or another provider). */
    UnlinkOutcome unlinkOAuth(UUID userId, OAuthProvider provider);

    List<LinkedOAuthIdentity> listOAuthIdentities(UUID userId);

    record AuthenticatedUser(UUID id, String email, String nickname, String globalRole) {}

    record LinkedOAuthIdentity(OAuthProvider provider, String email, Instant linkedAt) {}

    enum LinkOutcome { LINKED, ALREADY_LINKED, IDENTITY_USED_BY_OTHER_ACCOUNT, PROVIDER_HAS_OTHER_IDENTITY, ACCOUNT_UNAVAILABLE }

    enum UnlinkOutcome { UNLINKED, NOT_LINKED, LAST_LOGIN_METHOD }
}
