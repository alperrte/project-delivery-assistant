package com.pda.task.application;

import com.pda.task.domain.TaskDraft;
import com.pda.task.domain.TaskCreationMode;

import java.util.Set;
import java.util.UUID;

/**
 * Everything a manager can set when creating or updating a task. The {@code draft} is always a full replacement of
 * the basic fields. JSON PATCH tracks the supplied advanced fields so omission preserves them and explicit null
 * clears estimates/parent/sprint. Null assignees, labels or pool leave that part of the task untouched.
 */
public record TaskCommand(TaskDraft draft, Set<UUID> assigneeIds, Set<UUID> labelIds, UUID parentTaskId,
                          UUID sprintId, PoolRequest pool, TaskCreationMode creationMode, Set<String> providedFields) {

    public TaskCommand(TaskDraft draft, Set<UUID> assigneeIds, Set<UUID> labelIds, UUID parentTaskId,
                       UUID sprintId, PoolRequest pool) {
        this(draft, assigneeIds, labelIds, parentTaskId, sprintId, pool, null, null);
    }

    /** Old internal callers fully replace advanced fields; JSON PATCH callers retain omitted fields. */
    public boolean provides(String field) { return providedFields == null || providedFields.contains(field); }

    public record PoolRequest(boolean open, UUID teamId) {}
}
