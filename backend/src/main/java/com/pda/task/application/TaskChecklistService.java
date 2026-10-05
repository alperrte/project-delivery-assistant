package com.pda.task.application;

import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskChecklistItemRepository;
import com.pda.user.ProjectPermission;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/** Checklist of a task: anyone who can view reads it, a manager or an assignee changes it. */
@Service
public class TaskChecklistService {
    private final TaskSupport support;
    private final TaskChecklistItemRepository items;

    public TaskChecklistService(TaskSupport support, TaskChecklistItemRepository items) {
        this.support = support; this.items = items;
    }

    public record ChecklistItemView(UUID id, String text, boolean done, int position, UUID doneBy, Instant doneAt) {
        static ChecklistItemView of(TaskChecklistItem item) {
            return new ChecklistItemView(item.getId(), item.getText(), item.isDone(), item.getPosition(),
                    item.getDoneBy(), item.getDoneAt());
        }
    }

    @Transactional(readOnly = true)
    public List<ChecklistItemView> list(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        return ordered(taskId);
    }

    @Transactional
    public ChecklistItemView add(UUID projectId, UUID taskId, UUID actor, String text) {
        Task task = writable(projectId, taskId, actor);
        if (items.countByTaskId(taskId) >= TaskChecklistItem.MAX_PER_TASK) {
            throw new TaskValidationException("TASK_CHECKLIST_LIMIT", "Checklist is full");
        }
        int position = items.findByTaskIdOrderByPositionAscCreatedAtAsc(taskId).stream()
                .mapToInt(TaskChecklistItem::getPosition).max().orElse(-1) + 1;
        TaskChecklistItem item = items.save(new TaskChecklistItem(taskId, text, position, actor));
        support.record(taskId, projectId, actor, ActivityType.CHECKLIST_ITEM_ADDED, "checklist", null, item.getText());
        task.touchedBy(actor);
        return ChecklistItemView.of(item);
    }

    @Transactional
    public ChecklistItemView update(UUID projectId, UUID taskId, UUID itemId, UUID actor, String text, Boolean done) {
        Task task = writable(projectId, taskId, actor);
        TaskChecklistItem item = items.findByIdAndTaskId(itemId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Checklist item not found"));
        if (text == null && done == null) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Nothing to update");
        }
        if (text != null) item.rename(text);
        if (done != null && item.setDone(done, actor)) {
            support.record(taskId, projectId, actor,
                    done ? ActivityType.CHECKLIST_ITEM_DONE : ActivityType.CHECKLIST_ITEM_REOPENED,
                    "checklist", null, item.getText());
        }
        task.touchedBy(actor);
        return ChecklistItemView.of(item);
    }

    @Transactional
    public void delete(UUID projectId, UUID taskId, UUID itemId, UUID actor) {
        Task task = writable(projectId, taskId, actor);
        TaskChecklistItem item = items.findByIdAndTaskId(itemId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Checklist item not found"));
        items.delete(item);
        task.touchedBy(actor);
    }

    /** {@code orderedIds} must be exactly the task's current items, in the wanted order. */
    @Transactional
    public List<ChecklistItemView> reorder(UUID projectId, UUID taskId, UUID actor, List<UUID> orderedIds) {
        Task task = writable(projectId, taskId, actor);
        List<TaskChecklistItem> current = items.findByTaskIdOrderByPositionAscCreatedAtAsc(taskId);
        Map<UUID, TaskChecklistItem> byId = current.stream()
                .collect(Collectors.toMap(TaskChecklistItem::getId, i -> i));
        if (orderedIds.size() != current.size() || !byId.keySet().equals(new HashSet<>(orderedIds))) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Order must list every checklist item once");
        }
        for (int i = 0; i < orderedIds.size(); i++) byId.get(orderedIds.get(i)).moveTo(i);
        task.touchedBy(actor);
        return ordered(taskId);
    }

    private Task writable(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.locked(projectId, taskId);
        support.requireWork(projectId, actor, taskId);
        support.requireAdvancedTask(task);
        return task;
    }

    private List<ChecklistItemView> ordered(UUID taskId) {
        return items.findByTaskIdOrderByPositionAscCreatedAtAsc(taskId).stream().map(ChecklistItemView::of).toList();
    }
}
