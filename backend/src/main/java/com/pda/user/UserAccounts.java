package com.pda.user;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;
import java.util.UUID;

/** Public User module contract for Auth use cases. */
public interface UserAccounts {
    /** Creates an ACTIVE local account at once (no email proof); the public sign-up uses {@link #registerPendingLocal}. */
    UUID registerLocal(String email, String nickname, String rawPassword);
    /** Creates a local account that cannot sign in until its email is verified (PENDING_VERIFICATION). */
    UUID registerPendingLocal(String email, String nickname, String rawPassword);
    UUID registerInvitedLocal(String email, String nickname, String rawPassword, String firstName, String lastName);
    Optional<UUID> findPendingByEmail(String email);
    /** Id of the account that still waits for its email proof and holds this nickname, or empty. */
    Optional<UUID> findPendingByNickname(String nickname);
    /** Permanently removes an account that is still PENDING_VERIFICATION; any other account is left untouched. */
    boolean deletePending(UUID userId);
    /** True when the password is right for a PENDING_VERIFICATION account (equal work for unknown emails). */
    boolean matchesPendingLocal(String email, String password);
    boolean activateVerifiedEmail(UUID userId);
    Optional<AuthenticatedUser> authenticateLocal(String email, String password);
    Optional<AuthenticatedUser> findActiveById(UUID userId);
    /** Active, non-sensitive user summaries in one query for paginated team/member views. */
    Map<UUID, AuthenticatedUser> findActiveByIds(Set<UUID> userIds);
    /** Safe internal batch display profiles; callers derive IDs from their authorized membership scope. */
    Map<UUID, ProfileSummary> findActiveProfilesByIds(Set<UUID> userIds);
    record ProfileSummary(UUID userId, String nickname, String firstName, String lastName, Long profilePhotoVersion) {}

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

    /** True when the account can sign in with a password (a provider-only account cannot). */
    boolean hasPassword(UUID userId);

    /** True when the password is right for this ACTIVE account; false for wrong, missing or passwordless. */
    boolean passwordMatches(UUID userId, String password);

    /**
     * Anonymises an ACTIVE account for good: personal data, password, sessions, provider links, preferences and photo
     * are wiped, the status becomes DELETED and the email and nickname are freed. Publishes
     * {@link UserAccountDeletedEvent} in the same transaction. False when the account is not ACTIVE.
     */
    boolean deleteAccount(UUID userId);

    /** True for an administrator account; those cannot be deleted by their owner. */
    boolean isAdministrator(UUID userId);

    /** ACTIVE user id for that email (case-sensitive, matching {@code authenticateLocal}), or empty otherwise. */
    Optional<UUID> findActiveByEmail(String email);
    boolean emailExists(String email);

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

    /**
     * {@code profilePhotoVersion} is the epoch-millisecond version of the user's profile photo (null = no photo), meant
     * for the cache-busting `?v=` of `/users/{id}/profile-photo`; the photo bytes are never part of the summary.
     */
    record AuthenticatedUser(UUID id, String email, String nickname, String globalRole, boolean mustChangePassword,
                             Long profilePhotoVersion) {}

    record UserSearchResult(UUID userId, String nickname) {}

    record LinkedOAuthIdentity(OAuthProvider provider, String email, Instant linkedAt) {}

    enum LinkOutcome { LINKED, ALREADY_LINKED, IDENTITY_USED_BY_OTHER_ACCOUNT, PROVIDER_HAS_OTHER_IDENTITY, ACCOUNT_UNAVAILABLE }

    enum PasswordChangeOutcome { CHANGED, WRONG_CURRENT_PASSWORD, SAME_PASSWORD, ACCOUNT_UNAVAILABLE }

    enum UnlinkOutcome { UNLINKED, NOT_LINKED, LAST_LOGIN_METHOD }
}
