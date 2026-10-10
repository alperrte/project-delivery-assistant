package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.PasswordChangeChallenge;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordChangeChallengeRepository extends JpaRepository<PasswordChangeChallenge, UUID> {
    Optional<PasswordChangeChallenge> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
