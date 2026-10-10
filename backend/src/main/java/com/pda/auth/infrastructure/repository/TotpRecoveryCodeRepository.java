package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.TotpRecoveryCode;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TotpRecoveryCodeRepository extends JpaRepository<TotpRecoveryCode, UUID> {
    Optional<TotpRecoveryCode> findByUserIdAndCodeHashAndUsedAtIsNull(UUID userId, String codeHash);

    long countByUserIdAndUsedAtIsNull(UUID userId);

    void deleteByUserId(UUID userId);
}
