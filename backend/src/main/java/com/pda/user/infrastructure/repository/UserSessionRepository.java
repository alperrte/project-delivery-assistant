package com.pda.user.infrastructure.repository;

import com.pda.user.domain.entity.UserSession;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {
    List<UserSession> findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(UUID userId, Instant now);
}
