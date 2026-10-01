package com.pda.task.application;

import com.pda.project.ProjectSummaryView;
import com.pda.task.domain.Task;
import com.pda.task.domain.TaskStatus;
import com.pda.task.domain.TaskValidationException;
import com.pda.task.infrastructure.TaskRepository;
import com.pda.task.infrastructure.TaskSpecifications;
import com.pda.task.sprint.domain.Sprint;
import com.pda.task.sprint.domain.SprintStatus;
import com.pda.task.sprint.infrastructure.SprintRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The caller's own work across every active project they belong to. The identity always comes from the principal:
 * there is no user parameter, so nobody's tasks but the caller's can be reached through here.
 */
@Service
public class MyTasksService {
    public static final Set<String> SORT_FIELDS = Set.of("deadlineAt", "updatedAt", "priority");
    private static final Duration DUE_SOON = Duration.ofHours(24);

    public enum Scope { OPEN, DONE, ALL }

    public record Counts(long open, long overdue, long dueSoon, long blocked, int poolAvailable) {}

    public record MyTasksPage(List<TaskView> content, int page, int size, long totalElements, int totalPages,
                              Counts counts) {}

    private final TaskSupport support;
    private final TaskRepository tasks;
    private final SprintRepository sprints;
    private final TaskViewAssembler assembler;
    private final TaskPoolService pool;
    private final Clock clock;

    public MyTasksService(TaskSupport support, TaskRepository tasks, SprintRepository sprints,
                          TaskViewAssembler assembler, TaskPoolService pool, Clock clock) {
        this.support = support; this.tasks = tasks; this.sprints = sprints; this.assembler = assembler;
        this.pool = pool; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public MyTasksPage mine(UUID actor, Scope scope, Set<TaskStatus> statuses, UUID projectId, boolean overdue,
                            boolean activeSprintOnly, String sortField, boolean ascending, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || !SORT_FIELDS.contains(sortField)) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid paging or sort");
        }
        Instant now = clock.instant();
        Map<UUID, ProjectSummaryView> projects = support.projects().activeProjectsForUser(actor).stream()
                .collect(Collectors.toMap(ProjectSummaryView::id, Function.identity()));
        Specification<Task> mine = TaskSpecifications.inProjects(projects.keySet())
                .and(TaskSpecifications.active()).and(TaskSpecifications.assignedTo(actor));

        Specification<Task> filtered = mine;
        if (projectId != null) filtered = filtered.and(TaskSpecifications.inProject(projectId));
        filtered = switch (scope) {
            case OPEN -> filtered.and(TaskSpecifications.notDone());
            case DONE -> filtered.and(TaskSpecifications.done());
            case ALL -> filtered;
        };
        if (statuses != null && !statuses.isEmpty()) filtered = filtered.and(TaskSpecifications.statusIn(statuses));
        if (overdue) filtered = filtered.and(TaskSpecifications.overdue(now));
        if (activeSprintOnly) {
            Set<UUID> activeSprints = sprints
                    .findByProjectIdInAndStatusAndArchivedAtIsNull(projects.keySet(), SprintStatus.ACTIVE).stream()
                    .map(Sprint::getId).collect(Collectors.toSet());
            filtered = filtered.and(TaskSpecifications.inAnySprint(activeSprints));
        }

        PageRequest pageable = PageRequest.of(page, size);
        Page<Task> result = tasks.findAll(filtered.and(TaskSpecifications.orderBy(sortField, ascending)), pageable);
        List<TaskView> content = assembler.assemble(result.getContent(), actor, projects);
        return new MyTasksPage(content, result.getNumber(), result.getSize(), result.getTotalElements(),
                result.getTotalPages(), counts(mine, now, actor));
    }

    @Transactional(readOnly = true)
    public Counts counts(UUID actor) {
        Map<UUID, ProjectSummaryView> projects = support.projects().activeProjectsForUser(actor).stream()
                .collect(Collectors.toMap(ProjectSummaryView::id, Function.identity()));
        return counts(TaskSpecifications.inProjects(projects.keySet()).and(TaskSpecifications.active())
                .and(TaskSpecifications.assignedTo(actor)), clock.instant(), actor);
    }

    private Counts counts(Specification<Task> mine, Instant now, UUID actor) {
        return new Counts(
                tasks.count(mine.and(TaskSpecifications.notDone())),
                tasks.count(mine.and(TaskSpecifications.overdue(now))),
                tasks.count(mine.and(TaskSpecifications.dueBetween(now, now.plus(DUE_SOON)))),
                tasks.count(mine.and(TaskSpecifications.notDone()).and(TaskSpecifications.blocked())),
                pool.availableCount(actor));
    }
}
