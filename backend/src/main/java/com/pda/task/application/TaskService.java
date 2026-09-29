package com.pda.task.application;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectMemberRemovedEvent;
import com.pda.project.ProjectTaskContext;
import com.pda.task.TaskEvents;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.*;
import com.pda.user.ProjectPermission;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TaskService {
    private final ProjectAccess projects;
    private final TaskRepository tasks;
    private final TaskAssignmentRepository assignments;
    private final TaskStatusHistoryRepository histories;
    private final TaskKeyCounter keys;
    private final ApplicationEventPublisher events;

    public TaskService(ProjectAccess projects, TaskRepository tasks, TaskAssignmentRepository assignments,
                       TaskStatusHistoryRepository histories, TaskKeyCounter keys, ApplicationEventPublisher events) {
        this.projects = projects; this.tasks = tasks; this.assignments = assignments;
        this.histories = histories; this.keys = keys; this.events = events;
    }

    @Transactional
    public Task create(UUID projectId, UUID actor, String title, String description, TaskPriority priority,
                       LocalDate startDate, LocalDate dueDate) {
        ProjectTaskContext context = requireProject(projectId, actor, true);
        requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        TaskKeyCounter.Key key = keys.next(projectId, context.slug());
        Task task = tasks.save(Task.create(projectId, key.number(), key.taskKey(), title, description,
                priority, startDate, dueDate, actor));
        events.publishEvent(new TaskEvents.TaskCreatedEvent(task.getId(), projectId, actor, Instant.now()));
        return task;
    }

    @Transactional(readOnly = true)
    public Page<Task> list(UUID projectId, UUID actor, Pageable pageable) {
        requireProject(projectId, actor, false);
        requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        return tasks.findByProjectIdAndArchivedAtIsNull(projectId, pageable);
    }

    @Transactional(readOnly = true)
    public Task detail(UUID projectId, UUID taskId, UUID actor) {
        requireProject(projectId, actor, false);
        requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = scopedTask(projectId, taskId);
        if (task.getArchivedAt() != null) throw new NoSuchElementException("Task not found");
        return task;
    }

    @Transactional(readOnly = true)
    public Map<UUID, Set<UUID>> assigneesForTasks(UUID projectId, UUID actor, Collection<UUID> taskIds) {
        requireProject(projectId, actor, false);
        requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        if (taskIds.isEmpty()) return Map.of();
        Map<UUID, Set<UUID>> result = new HashMap<>();
        for (TaskAssignment assignment : assignments.findActiveByProjectAndTaskIds(projectId, taskIds)) {
            result.computeIfAbsent(assignment.getTaskId(), ignored -> new HashSet<>()).add(assignment.getUserId());
        }
        return result;
    }

    @Transactional
    public Task update(UUID projectId, UUID taskId, UUID actor, String title, String description,
                       TaskPriority priority, LocalDate startDate, LocalDate dueDate) {
        requireProject(projectId, actor, true);
        requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = scopedTask(projectId, taskId);
        task.requireActive();
        task.update(title, description, priority, startDate, dueDate, actor);
        return task;
    }

    @Transactional
    public Set<UUID> replaceAssignees(UUID projectId, UUID taskId, UUID actor, Set<UUID> userIds) {
        requireProject(projectId, actor, true);
        requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = tasks.lockScoped(projectId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Task not found"));
        task.requireActive();
        if (userIds == null || userIds.contains(null)) throw new IllegalArgumentException("Invalid assignee IDs");
        Set<UUID> desired = Set.copyOf(userIds);
        if (!projects.activeMemberIds(projectId, desired).containsAll(desired)) {
            throw new IllegalArgumentException("Assignee is not an active project member");
        }
        Map<UUID, TaskAssignment> current = assignments.findByTaskId(taskId).stream()
                .collect(Collectors.toMap(TaskAssignment::getUserId, a -> a));
        for (TaskAssignment existing : current.values()) {
            if (!desired.contains(existing.getUserId())) {
                assignments.delete(existing);
                events.publishEvent(new TaskEvents.TaskUnassignedEvent(taskId, projectId,
                        existing.getUserId(), actor, Instant.now()));
            }
        }
        for (UUID userId : desired) {
            if (!current.containsKey(userId)) {
                assignments.save(new TaskAssignment(taskId, userId, actor));
                events.publishEvent(new TaskEvents.TaskAssignedEvent(taskId, projectId, userId, actor, Instant.now()));
            }
        }
        return desired;
    }

    @Transactional
    public Task changeStatus(UUID projectId, UUID taskId, UUID actor, TaskStatus status) {
        requireProject(projectId, actor, true);
        requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = mutableTask(projectId, taskId);
        requireWorkPermission(projectId, actor, taskId);
        TaskStatus previous = task.getStatus();
        if (task.changeStatus(status, actor)) {
            histories.save(new TaskStatusHistory(taskId, previous, status, actor));
            events.publishEvent(new TaskEvents.TaskStatusChangedEvent(taskId, projectId,
                    previous, status, actor, Instant.now()));
            if (status == TaskStatus.DONE) events.publishEvent(new TaskEvents.TaskCompletedEvent(
                    taskId, projectId, actor, Instant.now()));
        }
        return task;
    }

    @Transactional
    public Task setBlocked(UUID projectId, UUID taskId, UUID actor, boolean blocked, String reason) {
        requireProject(projectId, actor, true);
        requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = mutableTask(projectId, taskId);
        requireWorkPermission(projectId, actor, taskId);
        if (task.setBlocked(blocked, reason, actor)) {
            if (blocked) events.publishEvent(new TaskEvents.TaskBlockedEvent(taskId, projectId, actor, Instant.now()));
            else events.publishEvent(new TaskEvents.TaskUnblockedEvent(taskId, projectId, actor, Instant.now()));
        }
        return task;
    }

    @Transactional(readOnly = true)
    public List<TaskStatusHistory> history(UUID projectId, UUID taskId, UUID actor) {
        detail(projectId, taskId, actor);
        return histories.findByTaskIdOrderByChangedAtAsc(taskId);
    }

    @Transactional
    public void archive(UUID projectId, UUID taskId, UUID actor) {
        requireProject(projectId, actor, true);
        requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = scopedTask(projectId, taskId);
        task.requireActive();
        task.archive(actor);
        events.publishEvent(new TaskEvents.TaskArchivedEvent(taskId, projectId, actor, Instant.now()));
    }

    @EventListener
    @Transactional
    public void memberRemoved(ProjectMemberRemovedEvent event) {
        List<TaskAssignment> stale = assignments.findByProjectAndUser(event.projectId(), event.userId());
        assignments.deleteByProjectAndUser(event.projectId(), event.userId());
        for (TaskAssignment assignment : stale) {
            events.publishEvent(new TaskEvents.TaskUnassignedEvent(assignment.getTaskId(), event.projectId(),
                    event.userId(), event.removedBy(), event.occurredAt()));
        }
    }

    private ProjectTaskContext requireProject(UUID projectId, UUID actor, boolean mutation) {
        ProjectTaskContext context = projects.taskContext(projectId);
        if (context == null) throw new NoSuchElementException("Project not found");
        if (context.archived()) {
            if (mutation && projects.isMemberIncludingArchived(projectId, actor))
                throw new TaskConflictException("Project is archived");
            throw new NoSuchElementException("Project not found");
        }
        return context;
    }

    private Task scopedTask(UUID projectId, UUID taskId) {
        return tasks.findByIdAndProjectId(taskId, projectId)
                .orElseThrow(() -> new NoSuchElementException("Task not found"));
    }

    private Task mutableTask(UUID projectId, UUID taskId) {
        Task task = scopedTask(projectId, taskId);
        task.requireActive();
        return task;
    }

    private void requirePermission(UUID projectId, UUID actor, ProjectPermission permission) {
        if (!projects.hasPermission(projectId, actor, permission))
            throw new AccessDeniedException("Project permission denied");
    }

    private void requireWorkPermission(UUID projectId, UUID actor, UUID taskId) {
        if (projects.hasPermission(projectId, actor, ProjectPermission.TASK_MANAGE)) return;
        if (projects.hasPermission(projectId, actor, ProjectPermission.TASK_WORK)
                && assignments.existsByTaskIdAndUserId(taskId, actor)) return;
        throw new AccessDeniedException("Task permission denied");
    }

}
