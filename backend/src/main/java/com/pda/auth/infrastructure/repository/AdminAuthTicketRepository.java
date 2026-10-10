package com.pda.auth.infrastructure.repository;

import com.pda.auth.domain.entity.AdminAuthTicket;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AdminAuthTicketRepository extends JpaRepository<AdminAuthTicket, UUID> {

    /** Single use: exactly one caller can flip an unconsumed, unexpired ticket; everybody else gets 0. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update AdminAuthTicket t set t.consumedAt = :now"
            + " where t.id = :id and t.consumedAt is null and t.expiresAt > :now")
    int consume(@Param("id") UUID id, @Param("now") Instant now);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from AdminAuthTicket t where t.userId = :userId")
    int deleteAllOf(@Param("userId") UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from AdminAuthTicket t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
