package com.pda.task.application;

import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskRelationRepository;
import com.pda.task.infrastructure.TaskRepository;
import com.pda.user.ProjectPermission;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Relations between tasks of one project. BLOCKS and DUPLICATES are directed, RELATES is stored once and read from
 * both sides. A BLOCKS edge that would close a loop is refused. Writes need TASK_MANAGE or assignment to the source.
 */
@Service
public class TaskRelationService {
    private final TaskSupport support;
    private final TaskRelationRepository relations;
    private final TaskRepository tasks;

    public TaskRelationService(TaskSupport support, TaskRelationRepository relations, TaskRepository tasks) {
        this.support = support; this.relations = relations; this.tasks = tasks;
    }

    public record RelatedTask(UUID relationId, UUID taskId, String key, String title, TaskStatus status) {}

    public record RelationsView(List<RelatedTask> blocks, List<RelatedTask> blockedBy, List<RelatedTask> relatesTo,
                                List<RelatedTask> duplicates, List<RelatedTask> duplicatedBy) {}

    @Transactional(readOnly = true)
    public RelationsView list(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        return view(taskId);
    }

    @Transactional
    public RelationsView add(UUID projectId, UUID taskId, UUID actor, RelationType type, UUID targetId) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.requireWork(projectId, actor, taskId);
        if (taskId.equals(targetId)) {
            throw new TaskValidationException("TASK_RELATION_INVALID", "A task cannot relate to itself");
        }
        for (UUID id : java.util.stream.Stream.of(taskId, targetId).sorted().toList()) support.locked(projectId, id);
        Task source = support.locked(projectId, taskId);
        support.requireAdvancedTask(source);
        Task target = support.locked(projectId, targetId);
        support.requireAdvancedTask(target);
        boolean exists = type == RelationType.BLOCKS
                ? relations.existsDirected(taskId, targetId, type)
                : relations.existsBetween(taskId, targetId, type);
        if (exists) throw new TaskConflictException("TASK_RELATION_EXISTS", "Relation already exists");
        if (type == RelationType.BLOCKS && blocksTransitively(targetId, taskId)) {
            throw new TaskConflictException("TASK_RELATION_CYCLE", "Relation would create a blocking loop");
        }
        relations.save(new TaskRelation(projectId, taskId, targetId, type, actor));
        support.record(taskId, projectId, actor, ActivityType.RELATION_ADDED, type.name(), null, target.getTaskKey());
        source.touchedBy(actor);
        return view(taskId);
    }

    @Transactional
    public RelationsView remove(UUID projectId, UUID taskId, UUID relationId, UUID actor) {
        Task task = writable(projectId, taskId, actor);
        TaskRelation relation = relations.findByIdAndProjectId(relationId, projectId)
                .filter(r -> r.getSourceTaskId().equals(taskId) || r.getTargetTaskId().equals(taskId))
                .orElseThrow(() -> new NoSuchElementException("Relation not found"));
        UUID otherId = relation.getSourceTaskId().equals(taskId) ? relation.getTargetTaskId()
                : relation.getSourceTaskId();
        String otherKey = tasks.findByIdAndProjectId(otherId, projectId).map(Task::getTaskKey).orElse(null);
        relations.delete(relation);
        support.record(taskId, projectId, actor, ActivityType.RELATION_REMOVED, relation.getType().name(),
                otherKey, null);
        task.touchedBy(actor);
        return view(taskId);
    }

    private Task writable(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.locked(projectId, taskId);
        support.requireWork(projectId, actor, taskId);
        support.requireAdvancedTask(task);
        return task;
    }

    /** True when {@code from} already blocks {@code to} through any chain of BLOCKS edges. */
    private boolean blocksTransitively(UUID from, UUID to) {
        Set<UUID> seen = new HashSet<>(Set.of(from));
        Set<UUID> frontier = Set.of(from);
        while (!frontier.isEmpty()) {
            Set<UUID> next = new HashSet<>();
            for (TaskRelation r : relations.findOfTasks(frontier)) {
                if (r.getType() != RelationType.BLOCKS || !frontier.contains(r.getSourceTaskId())) continue;
                UUID blocked = r.getTargetTaskId();
                if (blocked.equals(to)) return true;
                if (seen.add(blocked)) next.add(blocked);
            }
            frontier = next;
        }
        return false;
    }

    private RelationsView view(UUID taskId) {
        List<TaskRelation> rows = relations.findOfTask(taskId);
        Set<UUID> otherIds = new HashSet<>();
        for (TaskRelation r : rows) {
            otherIds.add(r.getSourceTaskId().equals(taskId) ? r.getTargetTaskId() : r.getSourceTaskId());
        }
        Map<UUID, Task> others = otherIds.isEmpty() ? Map.of()
                : tasks.findAllByIds(otherIds).stream().collect(Collectors.toMap(Task::getId, t -> t));
        List<RelatedTask> blocks = new ArrayList<>(), blockedBy = new ArrayList<>(), relatesTo = new ArrayList<>(),
                duplicates = new ArrayList<>(), duplicatedBy = new ArrayList<>();
        rows.stream().sorted(Comparator.comparing(TaskRelation::getCreatedAt)).forEach(r -> {
            boolean outgoing = r.getSourceTaskId().equals(taskId);
            Task other = others.get(outgoing ? r.getTargetTaskId() : r.getSourceTaskId());
            if (other == null || other.getArchivedAt() != null) return;
            RelatedTask entry = new RelatedTask(r.getId(), other.getId(), other.getTaskKey(), other.getTitle(),
                    other.getStatus());
            switch (r.getType()) {
                case BLOCKS -> (outgoing ? blocks : blockedBy).add(entry);
                case DUPLICATES -> (outgoing ? duplicates : duplicatedBy).add(entry);
                case RELATES -> relatesTo.add(entry);
            }
        });
        return new RelationsView(blocks, blockedBy, relatesTo, duplicates, duplicatedBy);
    }
}
