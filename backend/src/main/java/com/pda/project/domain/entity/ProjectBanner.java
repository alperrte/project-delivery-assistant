package com.pda.project.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** Banner bytes live apart from {@link Project} so list queries never read them. */
@Entity
@Table(name = "project_banners")
public class ProjectBanner {

    public static final int MAX_BYTES = 2 * 1024 * 1024;

    @Id
    @Column(name = "project_id")
    private UUID projectId;

    @Column(name = "content_type", nullable = false, length = 32)
    private String contentType;

    @Column(nullable = false, columnDefinition = "bytea")
    private byte[] data;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectBanner() {
    }

    public static ProjectBanner of(UUID projectId, String contentType, byte[] data, Instant at) {
        ProjectBanner banner = new ProjectBanner();
        banner.projectId = Objects.requireNonNull(projectId, "projectId is required");
        banner.replace(contentType, data, at);
        return banner;
    }

    public void replace(String contentType, byte[] data, Instant at) {
        Objects.requireNonNull(contentType, "contentType is required");
        Objects.requireNonNull(data, "data is required");
        if (data.length == 0 || data.length > MAX_BYTES) {
            throw new IllegalArgumentException("banner size is out of range");
        }
        this.contentType = contentType;
        this.data = data.clone();
        this.sizeBytes = data.length;
        this.updatedAt = Objects.requireNonNull(at, "at is required");
    }

    public UUID getProjectId() { return projectId; }
    public String getContentType() { return contentType; }
    public byte[] getData() { return data.clone(); }
    public int getSizeBytes() { return sizeBytes; }
    public Instant getUpdatedAt() { return updatedAt; }
}
