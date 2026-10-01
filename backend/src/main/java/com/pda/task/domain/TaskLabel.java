package com.pda.task.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "task_labels")
@IdClass(TaskLabel.Key.class)
public class TaskLabel {
    public static final int MAX_PER_TASK = 10;

    @Id @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Id @Column(name = "label_id", nullable = false, updatable = false) private UUID labelId;

    protected TaskLabel() {}

    public TaskLabel(UUID taskId, UUID labelId) {
        this.taskId = taskId;
        this.labelId = labelId;
    }

    public UUID getTaskId() { return taskId; }
    public UUID getLabelId() { return labelId; }

    public record Key(UUID taskId, UUID labelId) implements Serializable {
        public Key { Objects.requireNonNull(taskId); Objects.requireNonNull(labelId); }
    }
}
