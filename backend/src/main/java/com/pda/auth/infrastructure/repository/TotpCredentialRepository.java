package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.TotpCredential;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TotpCredentialRepository extends JpaRepository<TotpCredential, UUID> {
    Optional<TotpCredential> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
