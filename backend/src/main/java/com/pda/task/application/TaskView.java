package com.pda.task.application;

import com.pda.task.domain.TaskPriority;
import com.pda.task.domain.TaskStatus;
import com.pda.task.sprint.domain.SprintStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** A task enriched with everything a list row or the detail page needs, assembled in batch (no per-row queries). */
public record TaskView(
        UUID id, UUID projectId, long taskNumber, String taskKey, String title, String description,
        TaskStatus status, TaskPriority priority, LocalDate startDate, Instant deadlineAt, boolean overdue,
        boolean blocked, String blockedReason, boolean hasOpenBlockers,
        UUID createdBy, String createdByName, Instant createdAt,
        UUID updatedBy, String updatedByName, Instant updatedAt, Instant archivedAt, long version,
        Set<UUID> assigneeIds, List<PersonRef> assignees, List<LabelRef> labels, TaskRef parent,
        int subtaskCount, int subtaskDoneCount, int checklistTotal, int checklistDone,
        int commentCount, int attachmentCount,
        Integer estimatePoints, Integer timeEstimateMinutes, long loggedMinutes,
        SprintRef sprint, PoolRef pool, boolean watching, ProjectRef project) {

    /** A person as shown in lists and threads; {@code profilePhotoVersion} is null when they have no photo. */
    public record PersonRef(UUID userId, String nickname, Long profilePhotoVersion) {}
    public record LabelRef(UUID id, String name, String color) {}
    public record TaskRef(UUID id, String key, String title) {}
    public record SprintRef(UUID id, String name, SprintStatus status) {}
    public record PoolRef(boolean open, boolean claimed, UUID teamId, String teamName) {}
    public record ProjectRef(UUID id, String slug, String name, Long logoVersion) {}
}
