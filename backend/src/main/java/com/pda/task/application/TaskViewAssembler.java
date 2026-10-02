package com.pda.task.application;

import com.pda.project.ProjectSummaryView;
import com.pda.project.ProjectTeamDirectory;
import com.pda.task.application.TaskView.*;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.*;
import com.pda.task.sprint.domain.Sprint;
import com.pda.task.sprint.infrastructure.SprintRepository;
import com.pda.user.UserAccounts;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Builds {@link TaskView}s for a page of tasks with one query per relation, never one per row. */
@Component
public class TaskViewAssembler {
    private final TaskRepository tasks;
    private final TaskAssignmentRepository assignments;
    private final TaskLabelRepository taskLabels;
    private final ProjectLabelRepository labels;
    private final TaskChecklistItemRepository checklist;
    private final TaskCommentRepository comments;
    private final TaskAttachmentRepository attachments;
    private final TaskWorklogRepository worklogs;
    private final TaskWatcherRepository watchers;
    private final TaskRelationRepository relations;
    private final SprintRepository sprints;
    private final ProjectTeamDirectory teams;
    private final UserAccounts users;
    private final Clock clock;

    public TaskViewAssembler(TaskRepository tasks, TaskAssignmentRepository assignments,
                             TaskLabelRepository taskLabels, ProjectLabelRepository labels,
                             TaskChecklistItemRepository checklist, TaskCommentRepository comments,
                             TaskAttachmentRepository attachments, TaskWorklogRepository worklogs,
                             TaskWatcherRepository watchers, TaskRelationRepository relations,
                             SprintRepository sprints, ProjectTeamDirectory teams, UserAccounts users, Clock clock) {
        this.tasks = tasks; this.assignments = assignments; this.taskLabels = taskLabels; this.labels = labels;
        this.checklist = checklist; this.comments = comments; this.attachments = attachments;
        this.worklogs = worklogs; this.watchers = watchers; this.relations = relations; this.sprints = sprints;
        this.teams = teams; this.users = users; this.clock = clock;
    }

    public TaskView one(Task task, UUID viewer) {
        return assemble(List.of(task), viewer, null).get(0);
    }

    /** {@code projectInfo} is only given by cross-project views, where each row names its project. */
    public List<TaskView> assemble(List<Task> list, UUID viewer, Map<UUID, ProjectSummaryView> projectInfo) {
        if (list.isEmpty()) return List.of();
        Set<UUID> ids = list.stream().map(Task::getId).collect(Collectors.toSet());

        Map<UUID, List<UUID>> assigneesByTask = new HashMap<>();
        for (TaskAssignment a : assignments.findByTaskIds(ids)) {
            assigneesByTask.computeIfAbsent(a.getTaskId(), k -> new ArrayList<>()).add(a.getUserId());
        }

        Map<UUID, List<UUID>> labelIdsByTask = new HashMap<>();
        for (TaskLabel l : taskLabels.findByTaskIds(ids)) {
            labelIdsByTask.computeIfAbsent(l.getTaskId(), k -> new ArrayList<>()).add(l.getLabelId());
        }
        Map<UUID, ProjectLabel> labelsById = labelIdsByTask.isEmpty() ? Map.of()
                : labels.findAllById(labelIdsByTask.values().stream().flatMap(List::stream)
                        .collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(ProjectLabel::getId, Function.identity()));

        Set<UUID> parentIds = list.stream().map(Task::getParentTaskId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Task> parents = parentIds.isEmpty() ? Map.of() : tasks.findAllByIds(parentIds).stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));

        Map<UUID, int[]> subtasks = counts(tasks.subtaskCounts(ids));
        Map<UUID, int[]> checks = counts(checklist.countsByTaskIds(ids));
        Map<UUID, int[]> commentCounts = counts(comments.countsByTaskIds(ids));
        Map<UUID, int[]> attachmentCounts = counts(attachments.countsByTaskIds(ids));
        Map<UUID, Long> logged = new HashMap<>();
        for (Object[] row : worklogs.sumsByTaskIds(ids)) logged.put((UUID) row[0], ((Number) row[1]).longValue());

        Set<UUID> sprintIds = list.stream().map(Task::getSprintId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, Sprint> sprintsById = sprintIds.isEmpty() ? Map.of() : sprints.findAllByIds(sprintIds).stream()
                .collect(Collectors.toMap(Sprint::getId, Function.identity()));

        Set<UUID> teamIds = list.stream().map(Task::getPoolTeamId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, String> teamNames = teamIds.isEmpty() ? Map.of() : teams.teamNames(teamIds);

        Set<UUID> watched = viewer == null ? Set.of() : watchers.findByTaskIdsAndUser(ids, viewer).stream()
                .map(TaskWatcher::getTaskId).collect(Collectors.toSet());

        Set<UUID> blockedByOpen = openBlockedTargets(ids);

        Set<UUID> userIds = new HashSet<>();
        assigneesByTask.values().forEach(userIds::addAll);
        for (Task t : list) {
            userIds.add(t.getCreatedBy());
            if (t.getUpdatedBy() != null) userIds.add(t.getUpdatedBy());
        }
        Map<UUID, UserAccounts.AuthenticatedUser> names = users.findActiveByIds(userIds);

        Instant now = clock.instant();
        List<TaskView> views = new ArrayList<>(list.size());
        for (Task t : list) {
            List<UUID> assigneeList = assigneesByTask.getOrDefault(t.getId(), List.of());
            List<PersonRef> people = assigneeList.stream()
                    .map(id -> new PersonRef(id, nickname(names, id), photoVersion(names, id)))
                    .sorted(Comparator.comparing(p -> p.nickname() == null ? "" : p.nickname().toLowerCase()))
                    .toList();
            List<LabelRef> labelRefs = labelIdsByTask.getOrDefault(t.getId(), List.of()).stream()
                    .map(labelsById::get).filter(l -> l != null && l.getArchivedAt() == null)
                    .map(l -> new LabelRef(l.getId(), l.getName(), l.getColor()))
                    .sorted(Comparator.comparing(l -> l.name().toLowerCase())).toList();
            Task parent = t.getParentTaskId() == null ? null : parents.get(t.getParentTaskId());
            Sprint sprint = t.getSprintId() == null ? null : sprintsById.get(t.getSprintId());
            int[] sub = subtasks.getOrDefault(t.getId(), new int[2]);
            int[] chk = checks.getOrDefault(t.getId(), new int[2]);
            ProjectSummaryView info = projectInfo == null ? null : projectInfo.get(t.getProjectId());
            boolean overdue = t.getDeadlineAt() != null && t.getDeadlineAt().isBefore(now)
                    && t.getStatus() != TaskStatus.DONE && t.getArchivedAt() == null;
            views.add(new TaskView(t.getId(), t.getProjectId(), t.getTaskNumber(), t.getTaskKey(), t.getTitle(),
                    t.getDescription(), t.getStatus(), t.getPriority(), t.getStartDate(), t.getDeadlineAt(), overdue,
                    t.isBlocked(), t.getBlockedReason(), blockedByOpen.contains(t.getId()),
                    t.getCreatedBy(), nickname(names, t.getCreatedBy()), t.getCreatedAt(),
                    t.getUpdatedBy(), t.getUpdatedBy() == null ? null : nickname(names, t.getUpdatedBy()),
                    t.getUpdatedAt(), t.getArchivedAt(), t.getVersion(),
                    Set.copyOf(assigneeList), people, labelRefs,
                    parent == null ? null : new TaskRef(parent.getId(), parent.getTaskKey(), parent.getTitle()),
                    sub[0], sub[1], chk[0], chk[1],
                    commentCounts.getOrDefault(t.getId(), new int[2])[0],
                    attachmentCounts.getOrDefault(t.getId(), new int[2])[0],
                    t.getEstimatePoints(), t.getTimeEstimateMinutes(), logged.getOrDefault(t.getId(), 0L),
                    sprint == null ? null : new SprintRef(sprint.getId(), sprint.getName(), sprint.getStatus()),
                    new PoolRef(t.isPoolOpen(), t.isClaimedFromPool(), t.getPoolTeamId(),
                            t.getPoolTeamId() == null ? null : teamNames.get(t.getPoolTeamId())),
                    watched.contains(t.getId()),
                    info == null ? null : new ProjectRef(info.id(), info.slug(), info.name(), info.logoVersion())));
        }
        return views;
    }

    /** Tasks among {@code ids} that have at least one BLOCKS relation from a task that is still open. */
    private Set<UUID> openBlockedTargets(Set<UUID> ids) {
        List<TaskRelation> blockers = relations.findBlockersOf(ids);
        if (blockers.isEmpty()) return Set.of();
        Set<UUID> sourceIds = blockers.stream().map(TaskRelation::getSourceTaskId).collect(Collectors.toSet());
        Set<UUID> open = tasks.findAllByIds(sourceIds).stream()
                .filter(t -> t.getArchivedAt() == null && t.getStatus() != TaskStatus.DONE)
                .map(Task::getId).collect(Collectors.toSet());
        return blockers.stream().filter(r -> open.contains(r.getSourceTaskId()))
                .map(TaskRelation::getTargetTaskId).collect(Collectors.toSet());
    }

    private static Map<UUID, int[]> counts(List<Object[]> rows) {
        Map<UUID, int[]> result = new HashMap<>();
        for (Object[] row : rows) {
            int total = ((Number) row[1]).intValue();
            int done = row.length > 2 && row[2] != null ? ((Number) row[2]).intValue() : 0;
            result.put((UUID) row[0], new int[]{total, done});
        }
        return result;
    }

    private static Long photoVersion(Map<UUID, UserAccounts.AuthenticatedUser> names, UUID id) {
        UserAccounts.AuthenticatedUser user = names.get(id);
        return user == null ? null : user.profilePhotoVersion();
    }

    private static String nickname(Map<UUID, UserAccounts.AuthenticatedUser> names, UUID id) {
        UserAccounts.AuthenticatedUser user = names.get(id);
        return user == null ? null : user.nickname();
    }
}
