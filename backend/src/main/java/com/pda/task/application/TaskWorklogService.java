package com.pda.task.application;

import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskWorklogRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.UserAccounts;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

/** Time tracking: managers and assignees log time, only the owner or a manager changes an entry. */
@Service
public class TaskWorklogService {
    private final TaskSupport support;
    private final TaskWorklogRepository worklogs;
    private final UserAccounts users;
    private final Clock clock;

    public TaskWorklogService(TaskSupport support, TaskWorklogRepository worklogs, UserAccounts users, Clock clock) {
        this.support = support; this.worklogs = worklogs; this.users = users; this.clock = clock;
    }

    public record WorklogView(UUID id, UUID userId, String userName, int minutes, LocalDate workDate, String note,
                              Instant createdAt) {}

    public record WorklogList(List<WorklogView> entries, long totalMinutes) {}

    @Transactional(readOnly = true)
    public WorklogList list(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        return assemble(taskId);
    }

    @Transactional
    public WorklogList add(UUID projectId, UUID taskId, UUID actor, int minutes, LocalDate workDate, String note) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.mutable(projectId, taskId);
        support.requireWork(projectId, actor, taskId);
        worklogs.save(new TaskWorklog(taskId, projectId, actor, minutes, workDate, note, today()));
        support.record(taskId, projectId, actor, ActivityType.WORKLOG_ADDED, "worklog", null, minutes);
        task.touchedBy(actor);
        return assemble(taskId);
    }

    @Transactional
    public WorklogList update(UUID projectId, UUID taskId, UUID worklogId, UUID actor, int minutes,
                              LocalDate workDate, String note) {
        Owned owned = ownedEntry(projectId, taskId, worklogId, actor);
        owned.entry().change(minutes, workDate, note, today());
        owned.task().touchedBy(actor);
        return assemble(taskId);
    }

    @Transactional
    public WorklogList delete(UUID projectId, UUID taskId, UUID worklogId, UUID actor) {
        Owned owned = ownedEntry(projectId, taskId, worklogId, actor);
        owned.entry().delete();
        owned.task().touchedBy(actor);
        return assemble(taskId);
    }

    private record Owned(Task task, TaskWorklog entry) {}

    private Owned ownedEntry(UUID projectId, UUID taskId, UUID worklogId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.mutable(projectId, taskId);
        TaskWorklog entry = worklogs.findByIdAndTaskIdAndDeletedAtIsNull(worklogId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Worklog not found"));
        if (!entry.getUserId().equals(actor) && !support.can(projectId, actor, ProjectPermission.TASK_MANAGE)) {
            throw new AccessDeniedException("Worklog permission denied");
        }
        return new Owned(task, entry);
    }

    private WorklogList assemble(UUID taskId) {
        List<TaskWorklog> rows = worklogs.findByTaskIdAndDeletedAtIsNullOrderByWorkDateDescCreatedAtDesc(taskId);
        Set<UUID> userIds = new HashSet<>();
        rows.forEach(w -> userIds.add(w.getUserId()));
        Map<UUID, UserAccounts.AuthenticatedUser> names = userIds.isEmpty() ? Map.of()
                : users.findActiveByIds(userIds);
        long total = 0;
        List<WorklogView> views = new ArrayList<>(rows.size());
        for (TaskWorklog w : rows) {
            total += w.getMinutes();
            UserAccounts.AuthenticatedUser who = names.get(w.getUserId());
            views.add(new WorklogView(w.getId(), w.getUserId(), who == null ? null : who.nickname(), w.getMinutes(),
                    w.getWorkDate(), w.getNote(), w.getCreatedAt()));
        }
        return new WorklogList(views, total);
    }

    private LocalDate today() { return LocalDate.now(clock); }
}
