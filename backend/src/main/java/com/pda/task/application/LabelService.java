package com.pda.task.application;

import com.pda.task.domain.ProjectLabel;
import com.pda.task.domain.TaskConflictException;
import com.pda.task.infrastructure.ProjectLabelRepository;
import com.pda.task.infrastructure.TaskLabelRepository;
import com.pda.user.ProjectPermission;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/** Project labels: everyone who can view lists them, LABEL_MANAGE changes them. Archiving keeps existing tags. */
@Service
public class LabelService {
    private final TaskSupport support;
    private final ProjectLabelRepository labels;
    private final TaskLabelRepository taskLabels;

    public LabelService(TaskSupport support, ProjectLabelRepository labels, TaskLabelRepository taskLabels) {
        this.support = support; this.labels = labels; this.taskLabels = taskLabels;
    }

    public record LabelView(UUID id, String name, String color, long usageCount) {}

    @Transactional(readOnly = true)
    public List<LabelView> list(UUID projectId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Map<UUID, Long> usage = new HashMap<>();
        for (Object[] row : taskLabels.usageByProject(projectId)) usage.put((UUID) row[0], (Long) row[1]);
        return labels.findByProjectIdAndArchivedAtIsNullOrderByNameAsc(projectId).stream()
                .map(l -> view(l, usage.getOrDefault(l.getId(), 0L))).toList();
    }

    @Transactional
    public LabelView create(UUID projectId, UUID actor, String name, String color) {
        manage(projectId, actor);
        ProjectLabel label = new ProjectLabel(projectId, name, color, actor);
        requireFreeName(projectId, label.getName(), null);
        return view(labels.save(label), 0);
    }

    @Transactional
    public LabelView update(UUID projectId, UUID labelId, UUID actor, String name, String color) {
        manage(projectId, actor);
        ProjectLabel label = active(projectId, labelId);
        label.change(name, color);
        requireFreeName(projectId, label.getName(), labelId);
        return view(label, usageOf(projectId, labelId));
    }

    @Transactional
    public void archive(UUID projectId, UUID labelId, UUID actor) {
        manage(projectId, actor);
        active(projectId, labelId).archive();
    }

    private void manage(UUID projectId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.LABEL_MANAGE);
    }

    private ProjectLabel active(UUID projectId, UUID labelId) {
        ProjectLabel label = labels.findByIdAndProjectId(labelId, projectId)
                .orElseThrow(() -> new NoSuchElementException("Label not found"));
        if (label.getArchivedAt() != null) throw new NoSuchElementException("Label not found");
        return label;
    }

    private void requireFreeName(UUID projectId, String name, UUID excludeId) {
        if (labels.nameTaken(projectId, name, excludeId)) {
            throw new TaskConflictException("LABEL_NAME_EXISTS", "Label name already exists");
        }
    }

    private long usageOf(UUID projectId, UUID labelId) {
        for (Object[] row : taskLabels.usageByProject(projectId)) {
            if (labelId.equals(row[0])) return (Long) row[1];
        }
        return 0;
    }

    private static LabelView view(ProjectLabel label, long usage) {
        return new LabelView(label.getId(), label.getName(), label.getColor(), usage);
    }
}
