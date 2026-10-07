package com.pda.notification;

import com.pda.notification.application.NotificationFactory;
import com.pda.notification.domain.*;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TaskStatusNotificationFactoryTest {
    @Test void maximumLengthSnapshotsFitTheNotificationColumnsAndLegacyNotificationsStayUsable() {
        var factory = new NotificationFactory();
        UUID recipient = UUID.randomUUID(), actor = UUID.randomUUID(), project = UUID.randomUUID(), task = UUID.randomUUID();
        var change = new TaskStatusChange("IN_PROGRESS", "IN_REVIEW", "K".repeat(125), "T".repeat(160), "n".repeat(32));
        Notification notification = factory.statusChanged(recipient, actor, project, task, change);
        assertTrue(notification.getMessage().length() <= 500);
        assertEquals(change, notification.getStatusChange());
        assertEquals(NotificationType.TASK_STATUS_CHANGED, notification.getType());
        assertEquals(ResourceType.TASK, notification.getResourceType());
        assertNull(factory.create(recipient, actor, project, ResourceType.TASK, task,
                NotificationType.TASK_STATUS_CHANGED).getStatusChange());
    }
}
