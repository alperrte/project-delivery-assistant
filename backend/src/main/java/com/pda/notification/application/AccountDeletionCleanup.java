package com.pda.notification.application;

import com.pda.notification.infrastructure.NotificationRepository;
import com.pda.user.UserAccountDeletedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** The notifications of a deleted account are personal data; they go inside the deleting transaction. */
@Component
public class AccountDeletionCleanup {
    private final NotificationRepository notifications;

    public AccountDeletionCleanup(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @EventListener
    @Transactional
    public void accountDeleted(UserAccountDeletedEvent event) {
        notifications.deleteByRecipient(event.userId());
    }
}
