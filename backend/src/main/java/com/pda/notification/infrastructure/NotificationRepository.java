package com.pda.notification.infrastructure;

import com.pda.notification.domain.Notification;
import com.pda.notification.domain.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    @Query("select n from Notification n where n.recipientUserId = :userId and (:unreadOnly = false or n.read = false) and (:type is null or n.type = :type)")
    Page<Notification> list(UUID userId, boolean unreadOnly, NotificationType type, Pageable pageable);
    long countByRecipientUserIdAndReadFalse(UUID userId);
    Optional<Notification> findByIdAndRecipientUserId(UUID id, UUID userId);
    @Modifying
    @Query("update Notification n set n.read = true, n.readAt = :now where n.recipientUserId = :userId and n.read = false")
    int markAllRead(UUID userId, Instant now);
    @Modifying
    @Query("delete from Notification n where n.projectId = :projectId")
    int deleteByProjectId(UUID projectId);
}
