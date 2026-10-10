package com.pda.notification.application;

import com.pda.notification.domain.Notification;
import com.pda.notification.domain.NotificationType;
import com.pda.notification.infrastructure.NotificationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Collection;
import java.util.EnumSet;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

@Service
public class NotificationService {
    @jakarta.persistence.PersistenceContext private jakarta.persistence.EntityManager entityManager;
    private final NotificationRepository repository;
    private final org.springframework.jdbc.core.JdbcTemplate db;
    public NotificationService(NotificationRepository repository, org.springframework.jdbc.core.JdbcTemplate db) {
        this.repository = repository; this.db = db;
    }
    @Transactional
    public java.util.Optional<Notification> claimTeamDeletion(UUID user) {
        if (user == null) throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        var ids = db.query("WITH next AS (SELECT id FROM notifications WHERE recipient_user_id=? "
                        + "AND type='SQUAD_DELETED' AND is_read=false AND popup_presented_at IS NULL "
                        + "ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED) "
                        + "UPDATE notifications n SET popup_presented_at=now() FROM next "
                        + "WHERE n.id=next.id AND n.recipient_user_id=? RETURNING n.id",
                (rs, row) -> rs.getObject(1, UUID.class), user, user);
        if (ids.isEmpty()) return java.util.Optional.empty();
        Notification notification = repository.findByIdAndRecipientUserId(ids.getFirst(), user).orElseThrow();
        entityManager.refresh(notification);
        return java.util.Optional.of(notification);
    }
    @Transactional(readOnly = true)
    public Page<Notification> list(UUID user, boolean unreadOnly, NotificationType type, int page, int size) {
        return list(user, unreadOnly, null, type, page, size);
    }
    @Transactional(readOnly = true)
    public Page<Notification> list(UUID user, boolean unreadOnly, Boolean read, NotificationType type, int page, int size) {
        if (unreadOnly && Boolean.TRUE.equals(read)) throw new IllegalArgumentException("Conflicting read filters");
        Boolean state = read != null ? read : unreadOnly ? Boolean.FALSE : null;
        return repository.listByReadState(user, state, type, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
    }
    /** Optional {@code projectId} and {@code types} filters; null/empty means no restriction. Recipient is always {@code user}. */
    @Transactional(readOnly = true)
    public Page<Notification> list(UUID user, boolean unreadOnly, Boolean read, UUID projectId,
                                   Collection<NotificationType> types, int page, int size) {
        if (unreadOnly && Boolean.TRUE.equals(read)) throw new IllegalArgumentException("Conflicting read filters");
        Boolean state = read != null ? read : unreadOnly ? Boolean.FALSE : null;
        Set<NotificationType> set = typeSet(types);
        return repository.listFiltered(user, state, projectId, set.isEmpty(), set.isEmpty() ? ANY_TYPE : set,
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
    }
    @Transactional(readOnly = true)
    public long unreadCount(UUID user) { return repository.countByRecipientUserIdAndReadFalse(user); }
    /** Own unread count restricted by optional project and/or notification types (null/empty = unrestricted). */
    @Transactional(readOnly = true)
    public long unreadCount(UUID user, UUID projectId, Collection<NotificationType> types) {
        Set<NotificationType> set = typeSet(types);
        if (projectId == null && set.isEmpty()) return unreadCount(user);
        return repository.countUnreadFiltered(user, projectId, set.isEmpty(), set.isEmpty() ? ANY_TYPE : set);
    }
    private static Set<NotificationType> typeSet(Collection<NotificationType> types) {
        return types == null || types.isEmpty() ? Set.of() : EnumSet.copyOf(types);
    }
    private static final Set<NotificationType> ANY_TYPE = Set.of(NotificationType.values()[0]);
    @Transactional
    public Notification markRead(UUID user, UUID id) {
        repository.markRead(user, id, Instant.now());
        Notification notification = repository.findByIdAndRecipientUserId(id, user)
                .orElseThrow(() -> new NoSuchElementException("Notification not found"));
        // Bulk SQL may have changed an entity already loaded by this transaction. Never write its stale readAt back.
        entityManager.refresh(notification);
        return notification;
    }
    @Transactional
    public int markAllRead(UUID user) { return repository.markAllRead(user, Instant.now()); }
}
