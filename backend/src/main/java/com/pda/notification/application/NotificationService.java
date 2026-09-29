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
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class NotificationService {
    private final NotificationRepository repository;
    public NotificationService(NotificationRepository repository) { this.repository = repository; }
    @Transactional(readOnly = true)
    public Page<Notification> list(UUID user, boolean unreadOnly, NotificationType type, int page, int size) {
        return repository.list(user, unreadOnly, type, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
    }
    @Transactional(readOnly = true)
    public long unreadCount(UUID user) { return repository.countByRecipientUserIdAndReadFalse(user); }
    @Transactional
    public Notification markRead(UUID user, UUID id) {
        Notification notification = repository.findByIdAndRecipientUserId(id, user)
                .orElseThrow(() -> new NoSuchElementException("Notification not found"));
        notification.markRead();
        return notification;
    }
    @Transactional
    public int markAllRead(UUID user) { return repository.markAllRead(user, Instant.now()); }
}
