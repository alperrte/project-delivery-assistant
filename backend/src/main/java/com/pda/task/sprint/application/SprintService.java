package com.pda.task.sprint.application;

import com.pda.task.application.TaskSupport;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskActivityRepository;
import com.pda.task.infrastructure.TaskRepository;
import com.pda.task.infrastructure.TaskWorklogRepository;
import com.pda.task.sprint.domain.Sprint;
import com.pda.task.sprint.domain.SprintStatus;
import com.pda.task.sprint.infrastructure.SprintRepository;
import com.pda.user.ProjectPermission;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/** Sprints of a project: TASK_MANAGE runs them, anyone who can view reads them. One sprint is ACTIVE at a time. */
@Service
public class SprintService {
    private final TaskSupport support;
    private final SprintRepository sprints;
    private final TaskRepository tasks;
    private final TaskActivityRepository activities;
    private final TaskWorklogRepository worklogs;
    private final Clock clock;

    public SprintService(TaskSupport support, SprintRepository sprints, TaskRepository tasks,
                         TaskActivityRepository activities, TaskWorklogRepository worklogs, Clock clock) {
        this.support = support; this.sprints = sprints; this.tasks = tasks; this.activities = activities;
        this.worklogs = worklogs; this.clock = clock;
    }

    public record SprintView(UUID id, int sequence, String name, String goal, LocalDate startDate, LocalDate endDate,
                             SprintStatus status, long taskCount, Instant completedAt, long version) {}

    public record BurndownPoint(LocalDate date, int donePoints, int doneTasks, int remainingPoints,
                                int remainingTasks) {}

    public record SprintSummary(SprintView sprint, int totalTasks, int doneTasks, int totalPoints, int donePoints,
                                Map<TaskStatus, Long> byStatus, long loggedMinutes, List<BurndownPoint> burndown) {}

    @Transactional(readOnly = true)
    public List<SprintView> list(UUID projectId, UUID actor, SprintStatus status) {
        read(projectId, actor);
        List<Sprint> rows = status == null
                ? sprints.findByProjectIdAndArchivedAtIsNullOrderBySequenceDesc(projectId)
                : sprints.findByProjectIdAndStatusAndArchivedAtIsNullOrderBySequenceDesc(projectId, status);
        return rows.stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public SprintView get(UUID projectId, UUID sprintId, UUID actor) {
        read(projectId, actor);
        return view(find(projectId, sprintId));
    }

    @Transactional
    public SprintView create(UUID projectId, UUID actor, String name, String goal, LocalDate start, LocalDate end) {
        manage(projectId, actor);
        Sprint sprint = Sprint.create(projectId, sprints.maxSequence(projectId) + 1, name, goal, start, end, actor);
        return view(sprints.save(sprint));
    }

    @Transactional
    public SprintView update(UUID projectId, UUID sprintId, UUID actor, String name, String goal, LocalDate start,
                             LocalDate end) {
        manage(projectId, actor);
        Sprint sprint = lock(projectId, sprintId);
        sprint.update(name, goal, start, end, actor);
        return view(sprint);
    }

    @Transactional
    public SprintView start(UUID projectId, UUID sprintId, UUID actor) {
        manage(projectId, actor);
        Sprint sprint = lock(projectId, sprintId);
        if (sprint.getStatus() == SprintStatus.PLANNED
                && sprints.existsByProjectIdAndStatusAndArchivedAtIsNull(projectId, SprintStatus.ACTIVE)) {
            throw new TaskConflictException("SPRINT_ACTIVE_EXISTS", "Another sprint is already active");
        }
        sprint.start(actor);
        return view(sprint);
    }

    /**
     * Completes the active sprint. Finished tasks stay in it as its record; every other task goes to
     * {@code moveOpenTasksTo} (an open sprint of the project) or back to the backlog when that is null.
     */
    @Transactional
    public SprintView complete(UUID projectId, UUID sprintId, UUID actor, UUID moveOpenTasksTo) {
        manage(projectId, actor);
        Sprint sprint = lock(projectId, sprintId);
        sprint.complete(actor);
        if (moveOpenTasksTo != null) {
            Sprint target = sprints.findByIdAndProjectIdAndArchivedAtIsNull(moveOpenTasksTo, projectId)
                    .orElseThrow(() -> new TaskValidationException("SPRINT_INVALID", "Invalid target sprint"));
            if (target.getId().equals(sprintId) || !target.acceptsTasks()) {
                throw new TaskValidationException("SPRINT_INVALID", "Invalid target sprint");
            }
        }
        for (Task candidate : tasks.findActiveBySprint(sprintId).stream().sorted(java.util.Comparator.comparing(Task::getId)).toList()) {
            Task task = support.locked(projectId, candidate.getId());
            support.requireAdvancedTask(task);
            if (task.getStatus() == TaskStatus.DONE) continue;
            support.record(task.getId(), projectId, actor, ActivityType.SPRINT_CHANGED, "sprint", sprintId,
                    moveOpenTasksTo);
            task.setSprint(moveOpenTasksTo, actor);
        }
        return view(sprint);
    }

    /** Only a planned sprint without tasks can go; anything else carries history worth keeping. */
    @Transactional
    public void archive(UUID projectId, UUID sprintId, UUID actor) {
        manage(projectId, actor);
        Sprint sprint = lock(projectId, sprintId);
        if (tasks.countActiveInSprint(sprintId) > 0) {
            throw new TaskConflictException("SPRINT_NOT_EMPTY", "Sprint still has tasks");
        }
        sprint.archive(actor);
    }

    @Transactional(readOnly = true)
    public SprintSummary summary(UUID projectId, UUID sprintId, UUID actor) {
        read(projectId, actor);
        Sprint sprint = find(projectId, sprintId);
        List<Task> members = tasks.findActiveBySprint(sprintId);
        Map<TaskStatus, Long> byStatus = new EnumMap<>(TaskStatus.class);
        for (TaskStatus status : TaskStatus.values()) byStatus.put(status, 0L);
        int totalPoints = 0, donePoints = 0, doneTasks = 0;
        Map<UUID, Task> done = new HashMap<>();
        for (Task task : members) {
            int points = task.getEstimatePoints() == null ? 0 : task.getEstimatePoints();
            byStatus.merge(task.getStatus(), 1L, Long::sum);
            totalPoints += points;
            if (task.getStatus() == TaskStatus.DONE) {
                donePoints += points;
                doneTasks++;
                done.put(task.getId(), task);
            }
        }
        return new SprintSummary(view(sprint), members.size(), doneTasks, totalPoints, donePoints, byStatus,
                worklogs.sumForSprint(sprintId), burndown(sprint, done, members.size(), totalPoints));
    }

    /** One point per day from the sprint start to its end (or today / completion): what was finished and what is left. */
    private List<BurndownPoint> burndown(Sprint sprint, Map<UUID, Task> done, int totalTasks, int totalPoints) {
        Map<UUID, Instant> finishedAt = new HashMap<>();
        for (Object[] row : activities.doneMomentsForSprint(sprint.getId(), ActivityType.STATUS_CHANGED)) {
            UUID taskId = (UUID) row[0];
            if (done.containsKey(taskId)) finishedAt.put(taskId, (Instant) row[1]); // ordered: the latest one wins
        }
        Map<LocalDate, int[]> perDay = new HashMap<>();
        for (Map.Entry<UUID, Instant> entry : finishedAt.entrySet()) {
            LocalDate day = entry.getValue().atZone(clock.getZone()).toLocalDate();
            Integer points = done.get(entry.getKey()).getEstimatePoints();
            int[] bucket = perDay.computeIfAbsent(day, d -> new int[2]);
            bucket[0] += points == null ? 0 : points;
            bucket[1]++;
        }
        LocalDate today = LocalDate.now(clock);
        LocalDate last = sprint.getEndDate();
        if (sprint.getCompletedAt() != null) {
            last = sprint.getCompletedAt().atZone(clock.getZone()).toLocalDate();
        } else if (today.isBefore(last)) {
            last = today;
        }
        List<BurndownPoint> points = new ArrayList<>();
        int cumulativePoints = 0, cumulativeTasks = 0;
        for (LocalDate day = sprint.getStartDate(); !day.isAfter(last); day = day.plusDays(1)) {
            int[] bucket = perDay.getOrDefault(day, new int[2]);
            cumulativePoints += bucket[0];
            cumulativeTasks += bucket[1];
            points.add(new BurndownPoint(day, bucket[0], bucket[1], Math.max(0, totalPoints - cumulativePoints),
                    Math.max(0, totalTasks - cumulativeTasks)));
        }
        return points;
    }

    private void read(UUID projectId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
    }

    private void manage(UUID projectId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_MANAGE);
        support.requireAdvancedProject(projectId);
    }

    private Sprint find(UUID projectId, UUID sprintId) {
        return sprints.findByIdAndProjectIdAndArchivedAtIsNull(sprintId, projectId)
                .orElseThrow(() -> new NoSuchElementException("Sprint not found"));
    }

    private Sprint lock(UUID projectId, UUID sprintId) {
        return sprints.lockScoped(projectId, sprintId)
                .orElseThrow(() -> new NoSuchElementException("Sprint not found"));
    }

    private SprintView view(Sprint s) {
        return new SprintView(s.getId(), s.getSequence(), s.getName(), s.getGoal(), s.getStartDate(), s.getEndDate(),
                s.getStatus(), tasks.countActiveInSprint(s.getId()), s.getCompletedAt(), s.getVersion());
    }
}
