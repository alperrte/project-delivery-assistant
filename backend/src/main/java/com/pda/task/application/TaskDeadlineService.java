package com.pda.task.application;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectTaskContext;
import com.pda.task.TaskEvents;
import com.pda.task.domain.Task;
import com.pda.task.infrastructure.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * One scan of the deadline reminders. Candidates are read first, then each reminder marker is claimed with a
 * conditional UPDATE: only the caller that flips it publishes the event, so several instances (or a repeated scan)
 * never notify twice.
 */
@Service
public class TaskDeadlineService {
    static final Duration REMINDER_WINDOW = Duration.ofHours(24);

    private final TaskRepository tasks;
    private final TaskSupport support;
    private final ProjectAccess projects;
    private final Clock clock;

    public TaskDeadlineService(TaskRepository tasks, TaskSupport support, ProjectAccess projects, Clock clock) {
        this.tasks = tasks; this.support = support; this.projects = projects; this.clock = clock;
    }

    /** Returns how many notifications (soon + overdue) were published. */
    @Transactional
    public int scan() {
        Instant now = clock.instant();
        Map<UUID, Boolean> activeProjects = new HashMap<>();
        int published = 0;
        for (Task task : tasks.findNewlyOverdue(now)) {
            if (!projectIsActive(task.getProjectId(), activeProjects)) continue;
            if (tasks.claimOverdue(task.getId(), task.getDeadlineAt(), now) == 1) {
                support.publish(new TaskEvents.TaskOverdueEvent(task.getId(), task.getProjectId(),
                        task.getDeadlineAt(), recipients(task), now));
                published++;
            }
        }
        for (Task task : tasks.findDueSoon(now, now.plus(REMINDER_WINDOW))) {
            if (!projectIsActive(task.getProjectId(), activeProjects)) continue;
            if (tasks.claimReminder(task.getId(), task.getDeadlineAt(), now) == 1) {
                support.publish(new TaskEvents.TaskDeadlineSoonEvent(task.getId(), task.getProjectId(),
                        task.getDeadlineAt(), recipients(task), now));
                published++;
            }
        }
        return published;
    }

    private Set<UUID> recipients(Task task) { return support.followerIds(task.getId()); }

    private boolean projectIsActive(UUID projectId, Map<UUID, Boolean> cache) {
        return cache.computeIfAbsent(projectId, id -> {
            ProjectTaskContext context = projects.taskContext(id);
            return context != null && !context.archived();
        });
    }
}
