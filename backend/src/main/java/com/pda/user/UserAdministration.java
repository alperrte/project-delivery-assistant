package com.pda.user;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    /**
     * Newest first, paged on the server. {@code search} matches the email or nickname as a case-insensitive substring
     * (blank = no search); {@code status} is an {@code AccountStatus} name (blank = every status). An unknown status
     * is an {@link IllegalArgumentException}.
     */
    UserPage list(int page, int size, String search, String status);

    Optional<UserDetail> find(UUID userId, Instant now);

    /** Disables the account and revokes all its sessions. An administrator cannot disable self or the last active one. */
    StatusOutcome disable(UUID actorId, UUID targetId, Instant now);

    /** Re-enables a DISABLED account; idempotent for other statuses. {@code actorId} is only used for the log line. */
    StatusOutcome enable(UUID actorId, UUID targetId);

    /**
     * Nicknames of the given accounts for display in the administration (audit trail): any account that still exists and
     * has not been anonymised, whatever its status. Unknown and deleted accounts are simply absent. Never returns an email.
     */
    Map<UUID, String> nicknames(Set<UUID> userIds);

    UserCounts counts();

    /** Accounts created in {@code [from, toExclusive)}, cut into days of {@code zone}; empty days are absent. Never uses analytics data. */
    RegistrationReport registrations(Instant from, Instant toExclusive, ZoneId zone);

    record RegistrationReport(long inRange, List<DailyCount> daily) {}

    record DailyCount(LocalDate date, long count) {}

    record UserSummary(UUID id, String email, String nickname, String accountStatus, String emailVerificationStatus,
                       String globalRole, boolean mustChangePassword, Instant createdAt) {}

    record UserDetail(UserSummary user, List<OAuthProvider> linkedProviders, long activeSessions) {}

    record UserPage(List<UserSummary> items, int page, int size, long totalElements) {}

    record UserCounts(long total, long active, long disabled, long pendingVerification, long admins) {}

    enum BootstrapOutcome { CREATED, ADMIN_EXISTS, EMAIL_TAKEN }

    enum StatusOutcome { CHANGED, UNCHANGED, NOT_FOUND, SELF_DENIED, LAST_ADMIN }
}
