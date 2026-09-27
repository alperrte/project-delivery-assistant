package com.pda.user;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Public User module contract for platform administration (Admin module and startup bootstrap). It never returns
 * password hashes or tokens. Callers must have authorized the acting administrator with
 * {@link RolePolicy#allows(GlobalRole, PlatformPermission)} before invoking a mutation.
 */
public interface UserAdministration {

    /**
     * Creates the first administrator when none exists: ACTIVE, email VERIFIED, password hashed with BCrypt and a
     * forced first-login change. Never overwrites, promotes or resets an existing account.
     */
    BootstrapOutcome bootstrapAdmin(String email, String rawPassword);

    UserPage list(int page, int size);

    Optional<UserDetail> find(UUID userId, Instant now);

    /** Disables the account and revokes all its sessions. An administrator cannot disable self or the last active one. */
    StatusOutcome disable(UUID actorId, UUID targetId, Instant now);

    /** Re-enables a DISABLED account; idempotent for other statuses. */
    StatusOutcome enable(UUID targetId);

    UserCounts counts();

    record UserSummary(UUID id, String email, String nickname, String accountStatus, String emailVerificationStatus,
                       String globalRole, boolean mustChangePassword, Instant createdAt) {}

    record UserDetail(UserSummary user, List<OAuthProvider> linkedProviders, long activeSessions) {}

    record UserPage(List<UserSummary> items, int page, int size, long totalElements) {}

    record UserCounts(long total, long active, long disabled, long pendingVerification, long admins) {}

    enum BootstrapOutcome { CREATED, ADMIN_EXISTS, EMAIL_TAKEN }

    enum StatusOutcome { CHANGED, UNCHANGED, NOT_FOUND, SELF_DENIED, LAST_ADMIN }
}
