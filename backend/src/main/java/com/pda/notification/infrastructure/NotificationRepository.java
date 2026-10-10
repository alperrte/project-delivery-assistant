package com.pda.notification.infrastructure;

import com.pda.notification.domain.Notification;
import com.pda.notification.domain.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    @Query("select n from Notification n where n.recipientUserId = :userId and (:read is null or n.read = :read) and (:type is null or n.type = :type)")
    Page<Notification> listByReadState(UUID userId, Boolean read, NotificationType type, Pageable pageable);
    /** Filtered variant: {@code types} must be non-empty (callers pass a placeholder with {@code anyType=true}). */
    @Query("select n from Notification n where n.recipientUserId = :userId and (:read is null or n.read = :read) "
            + "and (:projectId is null or n.projectId = :projectId) and (:anyType = true or n.type in :types)")
    Page<Notification> listFiltered(UUID userId, Boolean read, UUID projectId, boolean anyType,
                                    Collection<NotificationType> types, Pageable pageable);
    long countByRecipientUserIdAndReadFalse(UUID userId);
    @Query("select count(n) from Notification n where n.recipientUserId = :userId and n.read = false "
            + "and (:projectId is null or n.projectId = :projectId) and (:anyType = true or n.type in :types)")
    long countUnreadFiltered(UUID userId, UUID projectId, boolean anyType, Collection<NotificationType> types);
    Optional<Notification> findByIdAndRecipientUserId(UUID id, UUID userId);
    @Modifying
    @Query("update Notification n set n.read = true, n.readAt = :now where n.id = :id and n.recipientUserId = :userId and n.read = false")
    int markRead(UUID userId, UUID id, Instant now);
    @Modifying
    @Query("update Notification n set n.read = true, n.readAt = :now where n.recipientUserId = :userId and n.read = false")
    int markAllRead(UUID userId, Instant now);
    @Modifying
    @Query("delete from Notification n where n.projectId = :projectId")
    int deleteByProjectId(UUID projectId);
}
