package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.PasswordResetChallenge;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetChallengeRepository extends JpaRepository<PasswordResetChallenge, UUID> {
    Optional<PasswordResetChallenge> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
