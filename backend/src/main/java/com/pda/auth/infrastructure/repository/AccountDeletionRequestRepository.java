package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.AccountDeletionRequest;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface AccountDeletionRequestRepository extends JpaRepository<AccountDeletionRequest, UUID> {
    Optional<AccountDeletionRequest> findByUserId(UUID userId);

    /** Locked, so two parallel confirmations of one link cannot both delete. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from AccountDeletionRequest r where r.tokenHash = :tokenHash")
    Optional<AccountDeletionRequest> lockByTokenHash(String tokenHash);

    void deleteByUserId(UUID userId);
}
