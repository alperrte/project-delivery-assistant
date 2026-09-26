package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.EmailVerificationChallenge;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationChallengeRepository extends JpaRepository<EmailVerificationChallenge, UUID> {
    Optional<EmailVerificationChallenge> findByUserId(UUID userId);
}
