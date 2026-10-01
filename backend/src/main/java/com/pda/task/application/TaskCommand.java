package com.pda.task.application;

import com.pda.task.domain.TaskDraft;

import java.util.Set;
import java.util.UUID;

/**
 * Everything a manager can set when creating or updating a task. The {@code draft} is always a full replacement of
 * the basic fields; {@code parentTaskId} and {@code sprintId} are replaced too (null clears them), while a null
 * {@code assigneeIds}, {@code labelIds} or {@code pool} leaves that part of the task untouched.
 */
public record TaskCommand(TaskDraft draft, Set<UUID> assigneeIds, Set<UUID> labelIds, UUID parentTaskId,
                          UUID sprintId, PoolRequest pool) {

    public record PoolRequest(boolean open, UUID teamId) {}
}
