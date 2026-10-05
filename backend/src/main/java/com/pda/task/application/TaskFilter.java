package com.pda.task.application;

import com.pda.task.domain.Task;
import com.pda.task.domain.TaskPriority;
import com.pda.task.domain.TaskStatus;
import com.pda.task.domain.TaskValidationException;
import com.pda.task.infrastructure.TaskSpecifications;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Server-side list filters of the project task list; every field is optional. */
public record TaskFilter(Set<TaskStatus> status, Set<TaskPriority> priority, UUID assigneeId, boolean unassigned,
                         String q, Set<UUID> labelIds, UUID sprintId, boolean backlog, boolean pool,
                         UUID parentId, boolean topLevel, boolean overdue, boolean blocked, com.pda.task.domain.TaskCreationMode creationMode) {

    public TaskFilter(Set<TaskStatus> status, Set<TaskPriority> priority, UUID assigneeId, boolean unassigned,
                      String q, Set<UUID> labelIds, UUID sprintId, boolean backlog, boolean pool,
                      UUID parentId, boolean topLevel, boolean overdue, boolean blocked) {
        this(status, priority, assigneeId, unassigned, q, labelIds, sprintId, backlog, pool, parentId,
                topLevel, overdue, blocked, null);
    }

    public static final int MIN_QUERY = 2;
    public static final int MAX_QUERY = 100;

    public Specification<Task> toSpecification(Instant now) {
        Specification<Task> spec = (root, query, cb) -> cb.conjunction();
        if (status != null && !status.isEmpty()) spec = spec.and(TaskSpecifications.statusIn(status));
        if (priority != null && !priority.isEmpty()) spec = spec.and(TaskSpecifications.priorityIn(priority));
        if (assigneeId != null) spec = spec.and(TaskSpecifications.assignedTo(assigneeId));
        if (unassigned) spec = spec.and(TaskSpecifications.unassigned());
        String text = q == null ? "" : q.trim();
        if (!text.isEmpty()) {
            if (text.length() < MIN_QUERY || text.length() > MAX_QUERY) {
                throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid search text");
            }
            spec = spec.and(TaskSpecifications.text(text));
        }
        if (labelIds != null && !labelIds.isEmpty()) spec = spec.and(TaskSpecifications.labelIn(labelIds));
        if (sprintId != null) spec = spec.and(TaskSpecifications.inSprint(sprintId));
        if (backlog) spec = spec.and(TaskSpecifications.backlog());
        if (pool) spec = spec.and(TaskSpecifications.poolOpen());
        if (parentId != null) spec = spec.and(TaskSpecifications.childOf(parentId));
        if (topLevel) spec = spec.and(TaskSpecifications.topLevel());
        if (overdue) spec = spec.and(TaskSpecifications.overdue(now));
        if (blocked) spec = spec.and(TaskSpecifications.blocked());
        if (creationMode != null) spec = spec.and((root, query, cb) -> cb.equal(root.get("creationMode"), creationMode));
        return spec;
    }
}
