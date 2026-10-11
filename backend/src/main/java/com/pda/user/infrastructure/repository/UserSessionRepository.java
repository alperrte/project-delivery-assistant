package com.pda.user.infrastructure.repository;

import com.pda.user.domain.entity.UserSession;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserSessionRepository extends JpaRepository<UserSession, UUID> {
    List<UserSession> findByUserIdAndRevokedAtIsNullAndExpiresAtAfter(UUID userId, Instant now);
    Optional<UserSession> findByRefreshTokenHash(String refreshTokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserSession s where s.refreshTokenHash = :hash")
    Optional<UserSession> findForRotationByRefreshTokenHash(@Param("hash") String hash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from UserSession s where s.previousRefreshTokenHash = :hash")
    Optional<UserSession> findForReplayCheckByPreviousRefreshTokenHash(@Param("hash") String hash);

    List<UserSession> findByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByCreatedAtDesc(UUID userId, Instant now);
    long countByUserIdAndRevokedAtIsNullAndExpiresAtAfter(UUID userId, Instant now);

    long countByRevokedAtIsNullAndExpiresAtAfter(Instant now);

    /** Physically removes every session row of an account that is being deleted. */
    @org.springframework.data.jpa.repository.Modifying
    @Query("delete from UserSession s where s.userId = :userId")
    int deleteAllOf(@Param("userId") UUID userId);
}
