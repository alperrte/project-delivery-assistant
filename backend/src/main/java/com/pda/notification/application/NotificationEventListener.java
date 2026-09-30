package com.pda.notification.application;

import com.pda.notification.domain.*;
import com.pda.project.ProjectMemberRemovedEvent;
import com.pda.project.ProjectInvitationEvents;
import com.pda.project.ProjectMembershipEvents;
import com.pda.squad.SquadMembershipEvents;
import com.pda.task.TaskEvents;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import java.util.Set;
import java.util.UUID;

@Component
public class NotificationEventListener {
    private final NotificationWriter writer;
    public NotificationEventListener(NotificationWriter writer) {
        this.writer = writer;
    }
    private void saveAll(Set<UUID> recipients, UUID actor, UUID project, UUID task, NotificationType type) {
        for (UUID recipient : recipients) writer.save(recipient, actor, project, ResourceType.TASK, task, type);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void assigned(TaskEvents.TaskAssignedEvent e) {
        writer.save(e.userId(), e.assignedBy(), e.projectId(), ResourceType.TASK, e.taskId(), NotificationType.TASK_ASSIGNED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void unassigned(TaskEvents.TaskUnassignedEvent e) {
        writer.save(e.userId(), e.unassignedBy(), e.projectId(), ResourceType.TASK, e.taskId(), NotificationType.TASK_UNASSIGNED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void status(TaskEvents.TaskStatusChangedEvent e) {
        saveAll(e.assigneeIds(), e.changedBy(), e.projectId(), e.taskId(), NotificationType.TASK_STATUS_CHANGED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void priority(TaskEvents.TaskPriorityChangedEvent e) {
        saveAll(e.assigneeIds(), e.changedBy(), e.projectId(), e.taskId(), NotificationType.TASK_PRIORITY_CHANGED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void dueDate(TaskEvents.TaskDueDateChangedEvent e) {
        saveAll(e.assigneeIds(), e.changedBy(), e.projectId(), e.taskId(), NotificationType.TASK_DUE_DATE_CHANGED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void blocked(TaskEvents.TaskBlockedEvent e) {
        saveAll(e.assigneeIds(), e.blockedBy(), e.projectId(), e.taskId(), NotificationType.TASK_BLOCKED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void projectAdded(ProjectMembershipEvents.MemberAdded e) {
        writer.save(e.userId(), e.addedBy(), e.projectId(), ResourceType.PROJECT, e.projectId(), NotificationType.PROJECT_MEMBER_ADDED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void projectRemoved(ProjectMemberRemovedEvent e) {
        writer.save(e.userId(), e.removedBy(), e.projectId(), ResourceType.PROJECT, e.projectId(), NotificationType.PROJECT_MEMBER_REMOVED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void rolesChanged(ProjectMembershipEvents.RolesChanged e) {
        writer.save(e.userId(), e.changedBy(), e.projectId(), ResourceType.PROJECT, e.projectId(), NotificationType.PROJECT_ROLE_CHANGED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void squadAdded(SquadMembershipEvents.MemberAdded e) {
        writer.save(e.userId(), e.addedBy(), e.projectId(), ResourceType.SQUAD, e.squadId(), NotificationType.SQUAD_MEMBER_ADDED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void squadRemoved(SquadMembershipEvents.MemberRemoved e) {
        writer.save(e.userId(), e.removedBy(), e.projectId(), ResourceType.SQUAD, e.squadId(), NotificationType.SQUAD_MEMBER_REMOVED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void invitationCreated(ProjectInvitationEvents.Created e) {
        writer.save(e.invitedUserId(), e.invitedBy(), e.projectId(), ResourceType.PROJECT_INVITATION,
                e.invitationId(), NotificationType.PROJECT_INVITATION_CREATED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void invitationAccepted(ProjectInvitationEvents.Accepted e) {
        writer.save(e.invitedBy(), e.invitedUserId(), e.projectId(), ResourceType.PROJECT_INVITATION,
                e.invitationId(), NotificationType.PROJECT_INVITATION_ACCEPTED);
    }
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void invitationRejected(ProjectInvitationEvents.Rejected e) {
        writer.save(e.invitedBy(), e.invitedUserId(), e.projectId(), ResourceType.PROJECT_INVITATION,
                e.invitationId(), NotificationType.PROJECT_INVITATION_REJECTED);
    }
}
