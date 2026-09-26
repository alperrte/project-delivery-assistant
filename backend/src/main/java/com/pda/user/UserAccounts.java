package com.pda.user;

import java.util.Optional;
import java.util.UUID;

/** Public User module contract for Auth use cases. */
public interface UserAccounts {
    UUID registerLocal(String email, String nickname, String rawPassword);
    Optional<UUID> findPendingByEmail(String email);
    boolean activateVerifiedEmail(UUID userId);
    Optional<AuthenticatedUser> authenticateLocal(String email, String password);
    Optional<AuthenticatedUser> findActiveById(UUID userId);

    record AuthenticatedUser(UUID id, String email, String nickname, String globalRole) {}
}
