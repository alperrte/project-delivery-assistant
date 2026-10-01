package com.pda.task.application;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectTaskContext;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.*;
import com.pda.user.ProjectPermission;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Shared guards and bookkeeping for the task services: project/permission checks, scoped task lookups, the activity
 * trail and the watcher set. Every method assumes it is called inside the caller's transaction.
 */
@Component
public class TaskSupport {
    private final ProjectAccess projects;
    private final TaskRepository tasks;
    private final TaskAssignmentRepository assignments;
    private final TaskWatcherRepository watchers;
    private final TaskActivityRepository activities;
    private final ApplicationEventPublisher events;

    public TaskSupport(ProjectAccess projects, TaskRepository tasks, TaskAssignmentRepository assignments,
                       TaskWatcherRepository watchers, TaskActivityRepository activities,
                       ApplicationEventPublisher events) {
        this.projects = projects; this.tasks = tasks; this.assignments = assignments;
        this.watchers = watchers; this.activities = activities; this.events = events;
    }

    public ProjectAccess projects() { return projects; }

    public void publish(Object event) { events.publishEvent(event); }

    /** Unknown or archived projects are 404; a member mutating an archived project gets a conflict instead. */
    public ProjectTaskContext requireProject(UUID projectId, UUID actor, boolean mutation) {
        ProjectTaskContext context = projects.taskContext(projectId);
        if (context == null) throw new NoSuchElementException("Project not found");
        if (context.archived()) {
            if (mutation && projects.isMemberIncludingArchived(projectId, actor))
                throw new TaskConflictException("PROJECT_ARCHIVED", "Project is archived");
            throw new NoSuchElementException("Project not found");
        }
        return context;
    }

    public void requirePermission(UUID projectId, UUID actor, ProjectPermission permission) {
        if (!projects.hasPermission(projectId, actor, permission))
            throw new AccessDeniedException("Project permission denied");
    }

    public boolean can(UUID projectId, UUID actor, ProjectPermission permission) {
        return projects.hasPermission(projectId, actor, permission);
    }

    /** TASK_MANAGE, or TASK_WORK while being one of the task's assignees. */
    public void requireWork(UUID projectId, UUID actor, UUID taskId) {
        if (!canWork(projectId, actor, taskId)) throw new AccessDeniedException("Task permission denied");
    }

    public boolean canWork(UUID projectId, UUID actor, UUID taskId) {
        if (projects.hasPermission(projectId, actor, ProjectPermission.TASK_MANAGE)) return true;
        return projects.hasPermission(projectId, actor, ProjectPermission.TASK_WORK)
                && assignments.existsByTaskIdAndUserId(taskId, actor);
    }

    /** Task of this project, archived or not; 404 when it belongs elsewhere. */
    public Task scoped(UUID projectId, UUID taskId) {
        return tasks.findByIdAndProjectId(taskId, projectId)
                .orElseThrow(() -> new NoSuchElementException("Task not found"));
    }

    /** Task of this project that is still active; archived tasks are conflicts for mutations. */
    public Task mutable(UUID projectId, UUID taskId) {
        Task task = scoped(projectId, taskId);
        task.requireActive();
        return task;
    }

    /** Active task read: archived tasks do not exist for readers. */
    public Task visible(UUID projectId, UUID taskId) {
        Task task = scoped(projectId, taskId);
        if (task.getArchivedAt() != null) throw new NoSuchElementException("Task not found");
        return task;
    }

    /** Row-locked active task, for read-modify-write sequences that must not interleave. */
    public Task locked(UUID projectId, UUID taskId) {
        Task task = tasks.lockScoped(projectId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Task not found"));
        task.requireActive();
        return task;
    }

    public void record(UUID taskId, UUID projectId, UUID actor, ActivityType type, String field,
                       Object oldValue, Object newValue) {
        activities.save(new TaskActivity(taskId, projectId, actor, type, field,
                oldValue == null ? null : oldValue.toString(), newValue == null ? null : newValue.toString()));
    }

    public void record(UUID taskId, UUID projectId, UUID actor, ActivityType type) {
        record(taskId, projectId, actor, type, null, null, null);
    }

    public void watch(UUID taskId, UUID userId) {
        if (userId != null) watchers.watch(taskId, userId);
    }

    public void watchAll(UUID taskId, Collection<UUID> userIds) {
        for (UUID userId : userIds) watch(taskId, userId);
    }

    public Set<UUID> assigneeIds(UUID taskId) {
        Set<UUID> ids = new LinkedHashSet<>();
        for (TaskAssignment assignment : assignments.findByTaskId(taskId)) ids.add(assignment.getUserId());
        return Collections.unmodifiableSet(ids);
    }

    /** Assignees plus watchers: everyone who should hear about changes to the task. */
    public Set<UUID> followerIds(UUID taskId) {
        Set<UUID> ids = new LinkedHashSet<>(assigneeIds(taskId));
        for (TaskWatcher watcher : watchers.findByTaskId(taskId)) ids.add(watcher.getUserId());
        return Collections.unmodifiableSet(ids);
    }
}
