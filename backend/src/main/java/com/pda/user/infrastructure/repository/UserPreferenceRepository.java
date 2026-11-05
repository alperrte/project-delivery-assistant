package com.pda.user.infrastructure.repository;

import com.pda.user.domain.entity.UserPreference;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface UserPreferenceRepository extends JpaRepository<UserPreference, UUID> {
    /** Serializes the first save as well as updates, without overwriting another request's fields. */
    @Modifying
    @Query(value = "INSERT INTO user_preferences(user_id, updated_at) VALUES (:userId, :at) ON CONFLICT (user_id) DO NOTHING",
            nativeQuery = true)
    void ensureExists(@Param("userId") UUID userId, @Param("at") Instant at);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from UserPreference p where p.userId = :userId")
    UserPreference lockByUserId(@Param("userId") UUID userId);
}
