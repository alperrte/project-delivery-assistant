package com.pda.user;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;
import java.util.UUID;

/** Public User module contract for Auth use cases. */
public interface UserAccounts {
    UUID registerLocal(String email, String nickname, String rawPassword);
    Optional<UUID> findPendingByEmail(String email);
    boolean activateVerifiedEmail(UUID userId);
    Optional<AuthenticatedUser> authenticateLocal(String email, String password);
    Optional<AuthenticatedUser> findActiveById(UUID userId);
    /** Active, non-sensitive user summaries in one query for paginated team/member views. */
    Map<UUID, AuthenticatedUser> findActiveByIds(Set<UUID> userIds);

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

    /**
     * Replaces the password of an ACTIVE account after verifying the current one. The new password must differ
     * from the current one. A successful change also ends a forced first-login change.
     */
    PasswordChangeOutcome changePassword(UUID userId, String currentPassword, String newPassword);

    /** ACTIVE user id for that email (case-sensitive, matching {@code authenticateLocal}), or empty otherwise. */
    Optional<UUID> findActiveByEmail(String email);

    /**
     * Replaces the password of an ACTIVE account WITHOUT checking the current one — reserved for flows that
     * already proved identity another way (an emailed reset code). Also ends a pending forced change. False
     * when the account is not ACTIVE.
     */
    boolean resetPassword(UUID userId, String newPassword);

    /**
     * Safe search for authenticated flows such as a project's "add member" lookup: nickname substring match
     * (case-insensitive) or an exact email match when the query contains "@". ACTIVE users only; queries shorter
     * than 2 characters return an empty list. Email is never returned in results. Result size is capped at 20
     * regardless of the requested limit.
     */
    List<UserSearchResult> searchActiveUsers(String query, int limit);

    record AuthenticatedUser(UUID id, String email, String nickname, String globalRole, boolean mustChangePassword) {}

    record UserSearchResult(UUID userId, String nickname) {}

    record LinkedOAuthIdentity(OAuthProvider provider, String email, Instant linkedAt) {}

    enum LinkOutcome { LINKED, ALREADY_LINKED, IDENTITY_USED_BY_OTHER_ACCOUNT, PROVIDER_HAS_OTHER_IDENTITY, ACCOUNT_UNAVAILABLE }

    enum PasswordChangeOutcome { CHANGED, WRONG_CURRENT_PASSWORD, SAME_PASSWORD, ACCOUNT_UNAVAILABLE }

    enum UnlinkOutcome { UNLINKED, NOT_LINKED, LAST_LOGIN_METHOD }
}
