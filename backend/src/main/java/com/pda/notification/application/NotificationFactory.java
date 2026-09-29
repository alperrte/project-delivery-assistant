package com.pda.notification.application;

import com.pda.notification.domain.*;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
public class NotificationFactory {
    public Notification create(UUID recipient, UUID actor, UUID projectId, ResourceType resourceType,
                               UUID resourceId, NotificationType type) {
        String title = switch (type) {
            case TASK_ASSIGNED -> "Task assigned";
            case TASK_UNASSIGNED -> "Task assignment removed";
            case TASK_STATUS_CHANGED -> "Task status changed";
            case TASK_PRIORITY_CHANGED -> "Task priority changed";
            case TASK_DUE_DATE_CHANGED -> "Task due date changed";
            case TASK_BLOCKED -> "Task blocked";
            case PROJECT_MEMBER_ADDED -> "Added to project";
            case PROJECT_MEMBER_REMOVED -> "Removed from project";
            case PROJECT_ROLE_CHANGED -> "Project role changed";
            case SQUAD_MEMBER_ADDED -> "Added to squad";
            case SQUAD_MEMBER_REMOVED -> "Removed from squad";
        };
        String message = switch (type) {
            case TASK_ASSIGNED -> "You were assigned to a task.";
            case TASK_UNASSIGNED -> "You were unassigned from a task.";
            case TASK_STATUS_CHANGED -> "A task assigned to you changed status.";
            case TASK_PRIORITY_CHANGED -> "A task assigned to you changed priority.";
            case TASK_DUE_DATE_CHANGED -> "A task assigned to you changed due date.";
            case TASK_BLOCKED -> "A task assigned to you was blocked.";
            case PROJECT_MEMBER_ADDED -> "You were added to a project.";
            case PROJECT_MEMBER_REMOVED -> "Your project membership was removed.";
            case PROJECT_ROLE_CHANGED -> "Your project role was changed.";
            case SQUAD_MEMBER_ADDED -> "You were added to a squad.";
            case SQUAD_MEMBER_REMOVED -> "You were removed from a squad.";
        };
        return new Notification(recipient, type, title, message, actor, projectId, resourceType, resourceId);
    }
}
