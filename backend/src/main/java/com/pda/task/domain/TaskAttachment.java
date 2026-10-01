package com.pda.task.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_attachments")
public class TaskAttachment {
    public static final long MAX_BYTES = 10L * 1024 * 1024;
    public static final int MAX_PER_TASK = 20;

    @Id private UUID id;
    @Column(name = "task_id", nullable = false, updatable = false) private UUID taskId;
    @Column(name = "project_id", nullable = false, updatable = false) private UUID projectId;
    @Column(name = "file_name", nullable = false, updatable = false, length = 200) private String fileName;
    @Column(name = "content_type", nullable = false, updatable = false, length = 100) private String contentType;
    @Column(name = "size_bytes", nullable = false, updatable = false) private long sizeBytes;
    @Column(nullable = false, updatable = false, length = 64) private String sha256;
    @Column(name = "uploaded_by", nullable = false, updatable = false) private UUID uploadedBy;
    @Column(name = "uploaded_at", nullable = false, updatable = false) private Instant uploadedAt;
    @Column(name = "deleted_at") private Instant deletedAt;
    @Column(name = "deleted_by") private UUID deletedBy;

    protected TaskAttachment() {}

    public TaskAttachment(UUID taskId, UUID projectId, String fileName, String contentType, long sizeBytes,
                          String sha256, UUID uploadedBy) {
        this.id = UUID.randomUUID();
        this.taskId = taskId;
        this.projectId = projectId;
        this.fileName = fileName;
        this.contentType = contentType;
        this.sizeBytes = sizeBytes;
        this.sha256 = sha256;
        this.uploadedBy = uploadedBy;
        this.uploadedAt = Instant.now();
    }

    public void delete(UUID actor) {
        if (deletedAt != null) return;
        deletedAt = Instant.now();
        deletedBy = actor;
    }

    public UUID getId() { return id; }
    public UUID getTaskId() { return taskId; }
    public UUID getProjectId() { return projectId; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getSha256() { return sha256; }
    public UUID getUploadedBy() { return uploadedBy; }
    public Instant getUploadedAt() { return uploadedAt; }
    public Instant getDeletedAt() { return deletedAt; }
}
