package com.pda.task.application;

import com.pda.task.application.TaskView.PersonRef;
import com.pda.task.domain.TaskWatcher;
import com.pda.task.infrastructure.TaskWatcherRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.UserAccounts;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Watching is a personal choice: a member only ever changes their own subscription. */
@Service
public class TaskWatcherService {
    private final TaskSupport support;
    private final TaskWatcherRepository watchers;
    private final UserAccounts users;

    public TaskWatcherService(TaskSupport support, TaskWatcherRepository watchers, UserAccounts users) {
        this.support = support; this.watchers = watchers; this.users = users;
    }

    public record WatchState(boolean watching) {}

    @Transactional(readOnly = true)
    public List<PersonRef> list(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        List<UUID> ids = watchers.findByTaskId(taskId).stream().map(TaskWatcher::getUserId).toList();
        Map<UUID, UserAccounts.AuthenticatedUser> names = ids.isEmpty() ? Map.of()
                : users.findActiveByIds(new HashSet<>(ids));
        return ids.stream().filter(names::containsKey)
                .map(id -> new PersonRef(id, names.get(id).nickname()))
                .sorted(Comparator.comparing(PersonRef::nickname, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    @Transactional
    public WatchState watch(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.mutable(projectId, taskId);
        support.watch(taskId, actor);
        return new WatchState(true);
    }

    @Transactional
    public WatchState unwatch(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.mutable(projectId, taskId);
        watchers.unwatch(taskId, actor);
        return new WatchState(false);
    }
}
