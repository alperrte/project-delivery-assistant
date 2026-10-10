package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.EmailVerificationChallenge;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmailVerificationChallengeRepository extends JpaRepository<EmailVerificationChallenge, UUID> {
    Optional<EmailVerificationChallenge> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);

    /** Challenges nobody used before they ran out: their accounts never proved the mailbox. */
    List<EmailVerificationChallenge> findByExpiresAtBeforeAndConsumedAtIsNull(Instant now);
}
