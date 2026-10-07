package com.pda.notification.application;

import com.pda.notification.infrastructure.NotificationRepository;
import com.pda.project.ProjectDeletedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@code notifications.project_id} is a scalar reference, not a foreign key, so deleting a project does not cascade to
 * it. The links in these notifications would only lead to a 404, so they go away inside the deleting transaction.
 */
@Component
public class ProjectDeletionCleanup {
    private final NotificationRepository notifications;

    public ProjectDeletionCleanup(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @EventListener
    @Transactional
    public void projectDeleted(ProjectDeletedEvent event) {
        notifications.deleteByProjectId(event.projectId());
    }
}
