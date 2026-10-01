package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_checklist_items")
public class TaskChecklistItem {
    public static final int MAX_PER_TASK = 50;

    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Column(nullable = false, length = 200) private String text;
    @Column(nullable = false) private boolean done;
    @Column(nullable = false) private int position;
    @Column(name = "done_by") private UUID doneBy;
    @Column(name = "done_at") private Instant doneAt;
    @Column(name = "created_by", nullable = false, updatable = false) private UUID createdBy;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected TaskChecklistItem() {}

    public TaskChecklistItem(UUID taskId, String text, int position, UUID actor) {
        this.id = UUID.randomUUID();
        this.taskId = taskId;
        this.text = normalize(text);
        this.position = position;
        this.createdBy = actor;
        this.createdAt = Instant.now();
    }

    private static String normalize(String text) {
        if (text == null || text.isBlank() || text.trim().length() > 200) {
            throw new TaskValidationException("TASK_INVALID_REQUEST", "Invalid checklist text");
        }
        return text.trim();
    }

    public void rename(String text) { this.text = normalize(text); }

    public boolean setDone(boolean value, UUID actor) {
        if (done == value) return false;
        done = value;
        doneBy = value ? actor : null;
        doneAt = value ? Instant.now() : null;
        return true;
    }

    public void moveTo(int position) { this.position = position; }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public String getText() { return text; }
    public boolean isDone() { return done; }
    public int getPosition() { return position; }
    public UUID getDoneBy() { return doneBy; }
    public Instant getDoneAt() { return doneAt; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
