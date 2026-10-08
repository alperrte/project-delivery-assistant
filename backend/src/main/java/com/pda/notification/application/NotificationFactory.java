package com.pda.notification.application;

import com.pda.notification.domain.*;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
public class NotificationFactory {
    public Notification invitation(UUID recipient, UUID actor, UUID projectId, UUID invitationId,
                                   NotificationType type, String projectName) {
        Notification notification = create(recipient, actor, projectId, ResourceType.PROJECT_INVITATION,
                invitationId, type);
        return projectName == null ? notification : notification.withInvitationContext(new InvitationContext(projectName));
    }
    public Notification teamDeleted(UUID recipient, UUID actor, UUID projectId, UUID teamId,
                                     UUID eventId, TeamDeletion deletion) {
        return Notification.teamDeleted(recipient, actor, projectId, teamId, eventId, deletion);
    }
    public Notification repositoryCommits(UUID recipient, UUID projectId, RepositoryCommits commits) {
        return Notification.repositoryCommits(recipient, projectId, commits);
    }
    public Notification statusChanged(UUID recipient, UUID actor, UUID projectId, UUID taskId,
                                      TaskStatusChange change) {
        String actorName = change.actorNickname() == null ? "Someone" : change.actorNickname();
        String taskName = change.taskKey() + ": " + change.taskTitle();
        String title = switch (change.newStatus()) {
            case "IN_PROGRESS" -> "Task started";
            case "DONE" -> "Task completed";
            default -> "Task status changed";
        };
        String message = switch (change.newStatus()) {
            case "IN_PROGRESS" -> actorName + " started " + taskName + ".";
            case "DONE" -> actorName + " completed " + taskName + ".";
            default -> actorName + " changed " + taskName + " from " + change.previousStatus()
                    + " to " + change.newStatus() + ".";
        };
        return new Notification(recipient, NotificationType.TASK_STATUS_CHANGED, title, message,
                actor, projectId, ResourceType.TASK, taskId, change);
    }

    public Notification create(UUID recipient, UUID actor, UUID projectId, ResourceType resourceType,
                               UUID resourceId, NotificationType type) {
        String title = switch (type) {
            case TASK_ASSIGNED -> "Task assigned";
            case TASK_UNASSIGNED -> "Task assignment removed";
            case TASK_STATUS_CHANGED -> "Task status changed";
            case TASK_PRIORITY_CHANGED -> "Task priority changed";
            case TASK_DUE_DATE_CHANGED -> "Task deadline changed";
            case TASK_BLOCKED -> "Task blocked";
            case TASK_DEADLINE_SOON -> "Task deadline approaching";
            case TASK_OVERDUE -> "Task overdue";
            case TASK_CLAIMED -> "Task claimed";
            case TASK_RELEASED -> "Task returned to the pool";
            case TASK_MENTIONED -> "You were mentioned";
            case TASK_COMMENTED -> "New task comment";
            case PROJECT_MEMBER_ADDED -> "Added to project";
            case PROJECT_MEMBER_REMOVED -> "Removed from project";
            case PROJECT_ROLE_CHANGED -> "Project role changed";
            case SQUAD_MEMBER_ADDED -> "Added to team";
            case SQUAD_MEMBER_REMOVED -> "Removed from team";
            case SQUAD_DELETED -> throw new IllegalArgumentException("Team deletion requires a snapshot");
            case REPOSITORY_COMMITS_PUSHED -> throw new IllegalArgumentException("Repository commits require a snapshot");
            case PROJECT_INVITATION_CREATED -> "Project invitation";
            case PROJECT_INVITATION_ACCEPTED -> "Invitation accepted";
            case PROJECT_INVITATION_REJECTED -> "Invitation rejected";
        };
        String message = switch (type) {
            case TASK_ASSIGNED -> "You were assigned to a task.";
            case TASK_UNASSIGNED -> "You were unassigned from a task.";
            case TASK_STATUS_CHANGED -> "A task you follow changed status.";
            case TASK_PRIORITY_CHANGED -> "A task you follow changed priority.";
            case TASK_DUE_DATE_CHANGED -> "A task you follow changed its deadline.";
            case TASK_BLOCKED -> "A task you follow was blocked.";
            case TASK_DEADLINE_SOON -> "A task you follow is due within 24 hours.";
            case TASK_OVERDUE -> "A task you follow passed its deadline.";
            case TASK_CLAIMED -> "A task you follow was claimed from the pool.";
            case TASK_RELEASED -> "A task you follow was returned to the pool.";
            case TASK_MENTIONED -> "You were mentioned in a task comment.";
            case TASK_COMMENTED -> "A task you follow has a new comment.";
            case PROJECT_MEMBER_ADDED -> "You were added to a project.";
            case PROJECT_MEMBER_REMOVED -> "Your project membership was removed.";
            case PROJECT_ROLE_CHANGED -> "Your project role was changed.";
            case SQUAD_MEMBER_ADDED -> "You were added to a team.";
            case SQUAD_MEMBER_REMOVED -> "You were removed from a team.";
            case SQUAD_DELETED -> throw new IllegalArgumentException("Team deletion requires a snapshot");
            case REPOSITORY_COMMITS_PUSHED -> throw new IllegalArgumentException("Repository commits require a snapshot");
            case PROJECT_INVITATION_CREATED -> "You were invited to a project.";
            case PROJECT_INVITATION_ACCEPTED -> "Your project invitation was accepted.";
            case PROJECT_INVITATION_REJECTED -> "Your project invitation was rejected.";
        };
        return new Notification(recipient, type, title, message, actor, projectId, resourceType, resourceId);
    }
}
