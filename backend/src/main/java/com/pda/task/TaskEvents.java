package com.pda.task;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * Public scalar-only integration events; consumers must not depend on Task persistence entities.
 * {@code recipientIds} are already the assignees plus watchers of the task (deduplicated); the consumer only
 * skips the acting user. Status-change recipients additionally include active project managers when work starts
 * or finishes; task and actor display values are snapshots captured in the successful mutation transaction.
 */
public final class TaskEvents {
    private TaskEvents() {}
    public record TaskCreatedEvent(UUID taskId, UUID projectId, UUID createdBy, Instant occurredAt) {}
    public record TaskAssignedEvent(UUID taskId, UUID projectId, UUID userId, UUID assignedBy,
                                    Instant occurredAt) {}
    public record TaskUnassignedEvent(UUID taskId, UUID projectId, UUID userId, UUID unassignedBy,
                                      Instant occurredAt) {}
    public record TaskStatusChangedEvent(UUID taskId, UUID projectId, String previousStatus,
                                         String newStatus, UUID changedBy, Set<UUID> assigneeIds,
                                         String taskKey, String taskTitle, String actorNickname, Instant occurredAt) {}
    public record TaskPriorityChangedEvent(UUID taskId, UUID projectId, UUID changedBy,
                                           Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskDueDateChangedEvent(UUID taskId, UUID projectId, Instant deadlineAt, UUID changedBy,
                                          Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskCompletedEvent(UUID taskId, UUID projectId, UUID completedBy, Instant occurredAt) {}
    public record TaskBlockedEvent(UUID taskId, UUID projectId, UUID blockedBy,
                                   Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskUnblockedEvent(UUID taskId, UUID projectId, UUID unblockedBy, Instant occurredAt) {}
    public record TaskArchivedEvent(UUID taskId, UUID projectId, UUID archivedBy, Instant occurredAt) {}

    /** Sent by the deadline scheduler (no acting user). */
    public record TaskDeadlineSoonEvent(UUID taskId, UUID projectId, Instant deadlineAt, Set<UUID> recipientIds,
                                        Instant occurredAt) {}
    public record TaskOverdueEvent(UUID taskId, UUID projectId, Instant deadlineAt, Set<UUID> recipientIds,
                                   Instant occurredAt) {}

    public record TaskClaimedEvent(UUID taskId, UUID projectId, UUID claimedBy, Set<UUID> recipientIds,
                                   Instant occurredAt) {}
    public record TaskReleasedEvent(UUID taskId, UUID projectId, UUID releasedBy, Set<UUID> recipientIds,
                                    Instant occurredAt) {}
    public record TaskCommentedEvent(UUID taskId, UUID projectId, UUID commentId, UUID authorId,
                                     Set<UUID> recipientIds, Instant occurredAt) {}
    public record TaskMentionedEvent(UUID taskId, UUID projectId, UUID commentId, UUID authorId,
                                     Set<UUID> mentionedUserIds, Instant occurredAt) {}
}
