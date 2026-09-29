package com.pda.task;

import com.pda.task.domain.TaskStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/** Public scalar-only integration events; consumers must not depend on Task persistence entities. */
public final class TaskEvents {
    private TaskEvents() {}
    public record TaskCreatedEvent(UUID taskId, UUID projectId, UUID createdBy, Instant occurredAt) {}
    public record TaskAssignedEvent(UUID taskId, UUID projectId, UUID userId, UUID assignedBy,
                                    Instant occurredAt) {}
    public record TaskUnassignedEvent(UUID taskId, UUID projectId, UUID userId, UUID unassignedBy,
                                      Instant occurredAt) {}
    public record TaskStatusChangedEvent(UUID taskId, UUID projectId, TaskStatus previousStatus,
                                         TaskStatus newStatus, UUID changedBy, Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskPriorityChangedEvent(UUID taskId, UUID projectId, UUID changedBy,
                                           Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskDueDateChangedEvent(UUID taskId, UUID projectId, LocalDate dueDate, UUID changedBy,
                                          Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskCompletedEvent(UUID taskId, UUID projectId, UUID completedBy, Instant occurredAt) {}
    public record TaskBlockedEvent(UUID taskId, UUID projectId, UUID blockedBy,
                                   Set<UUID> assigneeIds, Instant occurredAt) {}
    public record TaskUnblockedEvent(UUID taskId, UUID projectId, UUID unblockedBy, Instant occurredAt) {}
    public record TaskArchivedEvent(UUID taskId, UUID projectId, UUID archivedBy, Instant occurredAt) {}
}
