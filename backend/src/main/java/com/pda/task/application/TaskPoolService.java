package com.pda.task.application;

import com.pda.project.ProjectSummaryView;
import com.pda.project.ProjectTeamDirectory;
import com.pda.task.TaskEvents;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskAssignmentRepository;
import com.pda.task.infrastructure.TaskRepository;
import com.pda.task.infrastructure.TaskSpecifications;
import com.pda.user.ProjectPermission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Claiming and releasing pool tasks, and the cross-project list of what the caller may claim. */
@Service
public class TaskPoolService {
    /** The pool list is filtered by team in memory, so only this many newest open pool tasks are considered. */
    static final int POOL_SCAN_LIMIT = 500;

    private final TaskSupport support;
    private final TaskViewAssembler assembler;
    private final ProjectTeamDirectory teams;
    private final TaskRepository tasks;
    private final TaskAssignmentRepository assignments;
    private final Clock clock;

    public TaskPoolService(TaskSupport support, TaskViewAssembler assembler, ProjectTeamDirectory teams,
                           TaskRepository tasks, TaskAssignmentRepository assignments, Clock clock) {
        this.support = support; this.assembler = assembler; this.teams = teams; this.tasks = tasks;
        this.assignments = assignments; this.clock = clock;
    }

    @Transactional
    public TaskView claim(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_WORK);
        Task task = support.locked(projectId, taskId);
        support.requireAdvancedTask(task);
        if (!task.isPoolOpen()) {
            // The row lock makes the loser of a race see the winner's committed claim here.
            if (task.isClaimedFromPool() || assignments.countByTaskId(taskId) > 0) {
                throw new TaskConflictException("TASK_ALREADY_CLAIMED", "Task is already claimed");
            }
            throw new TaskConflictException("TASK_NOT_IN_POOL", "Task is not in the pool");
        }
        UUID targetTeam = task.getPoolTeamId();
        // A target team that has since been archived no longer restricts the pool offer.
        if (targetTeam != null && teams.isActiveTeam(projectId, targetTeam)
                && !teams.isActiveTeamMember(projectId, targetTeam, actor)) {
            throw new TaskForbiddenException("TASK_POOL_TEAM_ONLY", "Task is reserved for another team");
        }
        assignments.save(new TaskAssignment(taskId, actor, actor));
        task.claimed(actor);
        support.watch(taskId, actor);
        support.record(taskId, projectId, actor, ActivityType.CLAIMED);
        support.publish(new TaskEvents.TaskClaimedEvent(taskId, projectId, actor, support.followerIds(taskId),
                clock.instant()));
        return assembler.one(tasks.save(task), actor);
    }

    @Transactional
    public TaskView release(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_WORK);
        Task task = support.locked(projectId, taskId);
        support.requireAdvancedTask(task);
        List<TaskAssignment> current = assignments.findByTaskId(taskId);
        boolean releasable = task.isClaimedFromPool() && task.getStatus() != TaskStatus.DONE
                && current.size() == 1 && current.get(0).getUserId().equals(actor);
        if (!releasable) throw new TaskConflictException("TASK_NOT_RELEASABLE", "Task cannot be released");
        assignments.delete(current.get(0));
        task.returnedToPool(actor);
        support.record(taskId, projectId, actor, ActivityType.RELEASED);
        support.publish(new TaskEvents.TaskReleasedEvent(taskId, projectId, actor, support.followerIds(taskId),
                clock.instant()));
        return assembler.one(tasks.save(task), actor);
    }

    /** Open pool tasks the caller may claim in their active projects, newest first. */
    @Transactional(readOnly = true)
    public Page<TaskView> available(UUID actor, UUID projectId, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid paging");
        }
        Map<UUID, ProjectSummaryView> projects = claimableProjects(actor, projectId);
        List<Task> claimable = claimable(actor, projects);
        int from = (int) Math.min((long) page * size, claimable.size());
        List<Task> slice = claimable.subList(from, Math.min(from + size, claimable.size()));
        return new PageImpl<>(assembler.assemble(slice, actor, projects), PageRequest.of(page, size),
                claimable.size());
    }

    /** How many pool tasks the caller could claim right now (for the "my tasks" counters). */
    @Transactional(readOnly = true)
    public int availableCount(UUID actor) {
        return claimable(actor, claimableProjects(actor, null)).size();
    }

    private Map<UUID, ProjectSummaryView> claimableProjects(UUID actor, UUID onlyProject) {
        return support.projects().activeProjectsForUser(actor).stream()
                .filter(p -> p.permissions().contains(ProjectPermission.TASK_WORK))
                .filter(p -> p.taskManagementMode() != null && p.taskManagementMode().allows("ADVANCED"))
                .filter(p -> onlyProject == null || p.id().equals(onlyProject))
                .collect(Collectors.toMap(ProjectSummaryView::id, Function.identity()));
    }

    private List<Task> claimable(UUID actor, Map<UUID, ProjectSummaryView> projects) {
        if (projects.isEmpty()) return List.of();
        var spec = TaskSpecifications.inProjects(projects.keySet()).and(TaskSpecifications.active())
                .and(TaskSpecifications.poolOpen());
        List<Task> candidates = tasks.findAll(spec,
                PageRequest.of(0, POOL_SCAN_LIMIT, Sort.by(Sort.Direction.DESC, "updatedAt"))).getContent();
        Set<UUID> targetIds = candidates.stream().map(Task::getPoolTeamId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Set<UUID> activeTargets = targetIds.isEmpty() ? Set.of() : teams.activeTeamIds(targetIds);
        Map<UUID, Set<UUID>> myTeams = new HashMap<>();
        return candidates.stream().filter(task -> {
            UUID target = task.getPoolTeamId();
            if (target == null || !activeTargets.contains(target)) return true;
            return myTeams.computeIfAbsent(task.getProjectId(), id -> teams.activeTeamIdsOfUser(id, actor))
                    .contains(target);
        }).toList();
    }
}
