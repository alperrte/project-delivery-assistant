package com.pda.task.application;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectMemberRemovedEvent;
import com.pda.project.ProjectTaskContext;
import com.pda.project.ProjectTeamDirectory;
import com.pda.task.TaskEvents;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.*;
import com.pda.task.sprint.domain.Sprint;
import com.pda.task.sprint.infrastructure.SprintRepository;
import com.pda.user.ProjectPermission;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TaskService {
    static final int MAX_ASSIGNEES = 20;

    private final TaskSupport support;
    private final TaskViewAssembler assembler;
    private final ProjectAccess projects;
    private final ProjectTeamDirectory teams;
    private final TaskRepository tasks;
    private final TaskAssignmentRepository assignments;
    private final TaskStatusHistoryRepository histories;
    private final TaskWatcherRepository watchers;
    private final TaskLabelRepository taskLabels;
    private final ProjectLabelRepository labels;
    private final SprintRepository sprints;
    private final TaskKeyCounter keys;
    private final Clock clock;

    public TaskService(TaskSupport support, TaskViewAssembler assembler, ProjectAccess projects,
                       ProjectTeamDirectory teams, TaskRepository tasks, TaskAssignmentRepository assignments,
                       TaskStatusHistoryRepository histories, TaskWatcherRepository watchers,
                       TaskLabelRepository taskLabels, ProjectLabelRepository labels, SprintRepository sprints,
                       TaskKeyCounter keys, Clock clock) {
        this.support = support; this.assembler = assembler; this.projects = projects; this.teams = teams;
        this.tasks = tasks; this.assignments = assignments; this.histories = histories; this.watchers = watchers;
        this.taskLabels = taskLabels; this.labels = labels; this.sprints = sprints; this.keys = keys;
        this.clock = clock;
    }

    @Transactional
    public TaskView create(UUID projectId, UUID actor, TaskCommand command) {
        ProjectTaskContext context = support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Set<UUID> assignees = validAssignees(projectId, command.assigneeIds());
        TaskKeyCounter.Key key = keys.next(projectId, context.slug());
        Task task = tasks.save(Task.create(projectId, key.number(), key.taskKey(), command.draft(), actor));
        UUID taskId = task.getId();
        support.record(taskId, projectId, actor, ActivityType.CREATED);
        support.watch(taskId, actor);
        applyParent(task, projectId, command.parentTaskId(), actor);
        applySprint(task, projectId, command.sprintId(), actor);
        if (command.labelIds() != null) applyLabels(task, projectId, command.labelIds(), actor);
        if (!assignees.isEmpty()) applyAssignees(task, projectId, assignees, actor);
        if (command.pool() != null) applyPool(task, projectId, command.pool(), actor);
        support.publish(new TaskEvents.TaskCreatedEvent(taskId, projectId, actor, clock.instant()));
        return assembler.one(tasks.save(task), actor);
    }

    @Transactional(readOnly = true)
    public Page<TaskView> list(UUID projectId, UUID actor, TaskFilter filter, String sortField, boolean ascending,
                               int page, int size) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        if (page < 0 || size < 1 || size > 100 || !TaskSpecifications.SORT_FIELDS.contains(sortField)) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid paging or sort");
        }
        var spec = TaskSpecifications.inProject(projectId).and(TaskSpecifications.active())
                .and(filter.toSpecification(clock.instant()))
                .and(TaskSpecifications.orderBy(sortField, ascending));
        PageRequest pageable = PageRequest.of(page, size);
        Page<Task> result = tasks.findAll(spec, pageable);
        return new PageImpl<>(assembler.assemble(result.getContent(), actor, null), pageable,
                result.getTotalElements());
    }

    @Transactional(readOnly = true)
    public TaskView detail(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        return assembler.one(support.visible(projectId, taskId), actor);
    }

    @Transactional(readOnly = true)
    public List<TaskView> subtasks(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        List<Task> children = new ArrayList<>(tasks.findByParentTaskIdAndArchivedAtIsNull(taskId));
        children.sort(Comparator.comparingLong(Task::getTaskNumber));
        return assembler.assemble(children, actor, null);
    }

    @Transactional
    public TaskView update(UUID projectId, UUID taskId, UUID actor, TaskCommand command) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = support.locked(projectId, taskId);
        Set<UUID> assignees = command.assigneeIds() == null ? null : validAssignees(projectId, command.assigneeIds());
        Editable before = Editable.of(task);
        task.update(command.draft(), actor);
        recordFieldChanges(before, task, projectId, actor);
        applyParent(task, projectId, command.parentTaskId(), actor);
        applySprint(task, projectId, command.sprintId(), actor);
        if (command.labelIds() != null) applyLabels(task, projectId, command.labelIds(), actor);
        if (assignees != null) applyAssignees(task, projectId, assignees, actor);
        if (command.pool() != null) applyPool(task, projectId, command.pool(), actor);
        if (before.priority() != task.getPriority()) support.publish(new TaskEvents.TaskPriorityChangedEvent(
                taskId, projectId, actor, support.followerIds(taskId), clock.instant()));
        if (!Objects.equals(before.deadlineAt(), task.getDeadlineAt())) support.publish(
                new TaskEvents.TaskDueDateChangedEvent(taskId, projectId, task.getDeadlineAt(), actor,
                        support.followerIds(taskId), clock.instant()));
        return assembler.one(tasks.save(task), actor);
    }

    @Transactional
    public Set<UUID> replaceAssignees(UUID projectId, UUID taskId, UUID actor, Set<UUID> userIds) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = support.locked(projectId, taskId);
        Set<UUID> desired = validAssignees(projectId, userIds);
        applyAssignees(task, projectId, desired, actor);
        tasks.save(task);
        return desired;
    }

    @Transactional
    public TaskView changeStatus(UUID projectId, UUID taskId, UUID actor, TaskStatus status) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.mutable(projectId, taskId);
        support.requireWork(projectId, actor, taskId);
        TaskStatus previous = task.getStatus();
        boolean wasPoolOpen = task.isPoolOpen();
        if (task.changeStatus(status, actor)) {
            histories.save(new TaskStatusHistory(taskId, previous, status, actor));
            support.record(taskId, projectId, actor, ActivityType.STATUS_CHANGED, "status", previous, status);
            if (wasPoolOpen && !task.isPoolOpen()) support.record(taskId, projectId, actor, ActivityType.POOL_CLOSED);
            support.publish(new TaskEvents.TaskStatusChangedEvent(taskId, projectId, previous, status, actor,
                    support.followerIds(taskId), clock.instant()));
            if (status == TaskStatus.DONE) support.publish(new TaskEvents.TaskCompletedEvent(
                    taskId, projectId, actor, clock.instant()));
        }
        return assembler.one(task, actor);
    }

    @Transactional
    public TaskView setBlocked(UUID projectId, UUID taskId, UUID actor, boolean blocked, String reason) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.mutable(projectId, taskId);
        support.requireWork(projectId, actor, taskId);
        if (task.setBlocked(blocked, reason, actor)) {
            support.record(taskId, projectId, actor, blocked ? ActivityType.BLOCKED : ActivityType.UNBLOCKED,
                    "blocked", null, blocked ? task.getBlockedReason() : null);
            if (blocked) support.publish(new TaskEvents.TaskBlockedEvent(taskId, projectId, actor,
                    support.followerIds(taskId), clock.instant()));
            else support.publish(new TaskEvents.TaskUnblockedEvent(taskId, projectId, actor, clock.instant()));
        }
        return assembler.one(task, actor);
    }

    /** Moves the task into a sprint (or back to the backlog when {@code sprintId} is null). */
    @Transactional
    public TaskView changeSprint(UUID projectId, UUID taskId, UUID actor, UUID sprintId) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = support.locked(projectId, taskId);
        applySprint(task, projectId, sprintId, actor);
        return assembler.one(tasks.save(task), actor);
    }

    @Transactional
    public TaskView replaceLabels(UUID projectId, UUID taskId, UUID actor, Set<UUID> labelIds) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = support.locked(projectId, taskId);
        applyLabels(task, projectId, labelIds == null ? Set.of() : labelIds, actor);
        return assembler.one(tasks.save(task), actor);
    }

    @Transactional(readOnly = true)
    public List<TaskStatusHistory> history(UUID projectId, UUID taskId, UUID actor) {
        detail(projectId, taskId, actor);
        return histories.findByTaskIdOrderByChangedAtAsc(taskId);
    }

    @Transactional
    public void archive(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        Task task = support.locked(projectId, taskId);
        for (Task child : tasks.findByParentTaskIdAndArchivedAtIsNull(taskId)) archiveOne(child, projectId, actor);
        archiveOne(task, projectId, actor);
    }

    @EventListener
    @Transactional
    public void memberRemoved(ProjectMemberRemovedEvent event) {
        assignments.deleteByProjectAndUser(event.projectId(), event.userId());
        watchers.deleteByProjectAndUser(event.projectId(), event.userId());
    }

    private void archiveOne(Task task, UUID projectId, UUID actor) {
        task.archive(actor);
        support.record(task.getId(), projectId, actor, ActivityType.ARCHIVED);
        support.publish(new TaskEvents.TaskArchivedEvent(task.getId(), projectId, actor, clock.instant()));
    }

    private Set<UUID> validAssignees(UUID projectId, Collection<UUID> ids) {
        if (ids == null) return Set.of();
        if (ids.stream().anyMatch(Objects::isNull)) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid assignee IDs");
        }
        Set<UUID> desired = Set.copyOf(ids);
        if (desired.size() > MAX_ASSIGNEES) {
            throw new TaskValidationException("TASK_TOO_MANY_ASSIGNEES", "Too many assignees");
        }
        if (!desired.isEmpty() && !projects.activeMemberIds(projectId, desired).containsAll(desired)) {
            throw new TaskValidationException("TASK_ASSIGNEE_NOT_MEMBER", "Assignee is not an active project member");
        }
        return desired;
    }

    private void applyAssignees(Task task, UUID projectId, Set<UUID> desired, UUID actor) {
        UUID taskId = task.getId();
        Map<UUID, TaskAssignment> current = assignments.findByTaskId(taskId).stream()
                .collect(Collectors.toMap(TaskAssignment::getUserId, a -> a));
        for (TaskAssignment existing : current.values()) {
            if (desired.contains(existing.getUserId())) continue;
            assignments.delete(existing);
            support.record(taskId, projectId, actor, ActivityType.UNASSIGNED, "assignee", existing.getUserId(), null);
            support.publish(new TaskEvents.TaskUnassignedEvent(taskId, projectId, existing.getUserId(), actor,
                    clock.instant()));
        }
        for (UUID userId : desired) {
            if (current.containsKey(userId)) continue;
            assignments.save(new TaskAssignment(taskId, userId, actor));
            support.watch(taskId, userId);
            support.record(taskId, projectId, actor, ActivityType.ASSIGNED, "assignee", null, userId);
            support.publish(new TaskEvents.TaskAssignedEvent(taskId, projectId, userId, actor, clock.instant()));
        }
        boolean wasPoolOpen = task.isPoolOpen();
        // People assigned by hand end any pool offer; an emptied (formerly claimed) task is simply unassigned.
        if (!desired.isEmpty() || !wasPoolOpen) task.assignedDirectly(actor);
        if (wasPoolOpen && !task.isPoolOpen()) support.record(taskId, projectId, actor, ActivityType.POOL_CLOSED);
    }

    private void applyPool(Task task, UUID projectId, TaskCommand.PoolRequest request, UUID actor) {
        UUID taskId = task.getId();
        if (request.open()) {
            if (assignments.countByTaskId(taskId) > 0) {
                throw new TaskConflictException("TASK_POOL_HAS_ASSIGNEE", "A task with assignees cannot be pooled");
            }
            UUID teamId = request.teamId();
            if (teamId != null && !teams.isActiveTeam(projectId, teamId)) {
                throw new TaskValidationException("TASK_POOL_TEAM_INVALID", "Pool team is not an active project team");
            }
            boolean unchanged = task.isPoolOpen() && Objects.equals(task.getPoolTeamId(), teamId);
            task.openPool(teamId, actor);
            if (!unchanged) support.record(taskId, projectId, actor, ActivityType.POOL_OPENED, "team", null, teamId);
        } else if (task.isPoolOpen()) {
            task.closePool(actor);
            support.record(taskId, projectId, actor, ActivityType.POOL_CLOSED);
        }
    }

    private void applyParent(Task task, UUID projectId, UUID parentId, UUID actor) {
        if (Objects.equals(task.getParentTaskId(), parentId)) return;
        if (parentId != null) {
            if (parentId.equals(task.getId())) throw invalidParent();
            Task parent = tasks.findActiveByProjectAndIds(projectId, List.of(parentId)).stream().findFirst()
                    .orElseThrow(TaskService::invalidParent);
            // One level only: a subtask cannot have subtasks, and a task with subtasks cannot become one.
            if (parent.getParentTaskId() != null) throw invalidParent();
            if (!tasks.findByParentTaskIdAndArchivedAtIsNull(task.getId()).isEmpty()) throw invalidParent();
            support.record(parentId, projectId, actor, ActivityType.SUBTASK_ADDED, "subtask", null,
                    task.getTaskKey());
        }
        support.record(task.getId(), projectId, actor, ActivityType.PARENT_CHANGED, "parent",
                task.getParentTaskId(), parentId);
        task.setParent(parentId, actor);
    }

    private static TaskValidationException invalidParent() {
        return new TaskValidationException("TASK_INVALID_PARENT", "Invalid parent task");
    }

    private void applySprint(Task task, UUID projectId, UUID sprintId, UUID actor) {
        if (Objects.equals(task.getSprintId(), sprintId)) return;
        if (sprintId != null) {
            Sprint sprint = sprints.findByIdAndProjectIdAndArchivedAtIsNull(sprintId, projectId)
                    .orElseThrow(() -> new TaskValidationException("SPRINT_INVALID", "Invalid sprint"));
            if (!sprint.acceptsTasks()) throw new TaskConflictException("SPRINT_COMPLETED", "Sprint is completed");
        }
        support.record(task.getId(), projectId, actor, ActivityType.SPRINT_CHANGED, "sprint",
                task.getSprintId(), sprintId);
        task.setSprint(sprintId, actor);
    }

    private void applyLabels(Task task, UUID projectId, Set<UUID> requested, UUID actor) {
        if (requested.stream().anyMatch(Objects::isNull)) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid label IDs");
        }
        Set<UUID> desired = Set.copyOf(requested);
        if (desired.size() > TaskLabel.MAX_PER_TASK) {
            throw new TaskValidationException("TASK_LABEL_LIMIT", "Too many labels");
        }
        Map<UUID, ProjectLabel> found = desired.isEmpty() ? Map.of()
                : labels.findActiveByProjectAndIds(projectId, desired).stream()
                .collect(Collectors.toMap(ProjectLabel::getId, l -> l));
        if (found.size() != desired.size()) {
            throw new TaskValidationException("TASK_LABEL_INVALID", "Unknown label");
        }
        UUID taskId = task.getId();
        Map<UUID, TaskLabel> current = taskLabels.findByTaskId(taskId).stream()
                .collect(Collectors.toMap(TaskLabel::getLabelId, l -> l));
        if (current.keySet().equals(desired)) return;
        Map<UUID, String> names = new HashMap<>();
        labels.findAllById(current.keySet()).forEach(l -> names.put(l.getId(), l.getName()));
        found.values().forEach(l -> names.put(l.getId(), l.getName()));
        String before = join(current.keySet(), names);
        current.values().stream().filter(l -> !desired.contains(l.getLabelId())).forEach(taskLabels::delete);
        desired.stream().filter(id -> !current.containsKey(id)).forEach(id -> taskLabels.save(new TaskLabel(taskId, id)));
        support.record(taskId, projectId, actor, ActivityType.LABELS_CHANGED, "labels", before, join(desired, names));
    }

    private static String join(Collection<UUID> ids, Map<UUID, String> names) {
        return ids.stream().map(id -> names.getOrDefault(id, "?")).sorted().collect(Collectors.joining(", "));
    }

    /** The editable fields the activity trail compares; the managed task itself is mutated in place. */
    private record Editable(String title, String description, TaskPriority priority, java.time.LocalDate startDate,
                            java.time.Instant deadlineAt, Integer estimatePoints, Integer timeEstimateMinutes) {
        static Editable of(Task t) {
            return new Editable(t.getTitle(), t.getDescription(), t.getPriority(), t.getStartDate(),
                    t.getDeadlineAt(), t.getEstimatePoints(), t.getTimeEstimateMinutes());
        }
    }

    private void recordFieldChanges(Editable before, Task after, UUID projectId, UUID actor) {
        UUID id = after.getId();
        field(id, projectId, actor, "title", before.title(), after.getTitle(), false);
        field(id, projectId, actor, "description", before.description(), after.getDescription(), true);
        field(id, projectId, actor, "priority", before.priority(), after.getPriority(), false);
        field(id, projectId, actor, "startDate", before.startDate(), after.getStartDate(), false);
        field(id, projectId, actor, "deadlineAt", before.deadlineAt(), after.getDeadlineAt(), false);
        field(id, projectId, actor, "estimatePoints", before.estimatePoints(), after.getEstimatePoints(), false);
        field(id, projectId, actor, "timeEstimateMinutes", before.timeEstimateMinutes(),
                after.getTimeEstimateMinutes(), false);
    }

    private void field(UUID taskId, UUID projectId, UUID actor, String name, Object oldValue, Object newValue,
                       boolean omitValues) {
        if (Objects.equals(oldValue, newValue)) return;
        support.record(taskId, projectId, actor, ActivityType.FIELD_CHANGED, name,
                omitValues ? null : oldValue, omitValues ? null : newValue);
    }
}
