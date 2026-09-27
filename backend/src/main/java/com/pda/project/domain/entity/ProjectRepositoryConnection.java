package com.pda.project.domain.entity;

import com.pda.project.domain.enums.RepositoryProvider;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A project's public, read-only repository link (HMZ-PROJ-26). V1 supports exactly one connection per project
 * (the unique constraint on {@code project_id}); connecting again with a new call replaces it rather than adding
 * a second row. Never stores a token/credential: public repositories only, read via GitHub's public REST API.
 */
@Entity
@Table(name = "project_repository_connections",
        uniqueConstraints = @UniqueConstraint(name = "uk_project_repository_connections_project",
                columnNames = "project_id"))
public class ProjectRepositoryConnection {

    private static final int OWNER_LIMIT = 100;
    private static final int NAME_LIMIT = 100;
    private static final int URL_LIMIT = 500;
    private static final int BRANCH_LIMIT = 250;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RepositoryProvider provider;

    @Column(name = "repository_url", nullable = false, length = URL_LIMIT)
    private String repositoryUrl;

    @Column(name = "repository_owner", nullable = false, length = OWNER_LIMIT)
    private String repositoryOwner;

    @Column(name = "repository_name", nullable = false, length = NAME_LIMIT)
    private String repositoryName;

    @Column(name = "default_branch", nullable = false, length = BRANCH_LIMIT)
    private String defaultBranch;

    @Column(name = "connected_by", nullable = false, updatable = false)
    private UUID connectedBy;

    @Column(name = "connected_at", nullable = false, updatable = false)
    private Instant connectedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectRepositoryConnection() {
        // JPA
    }

    public static ProjectRepositoryConnection connect(UUID projectId, String owner, String repositoryName,
                                                       String repositoryUrl, String defaultBranch, UUID connectedBy) {
        ProjectRepositoryConnection connection = new ProjectRepositoryConnection();
        connection.projectId = Objects.requireNonNull(projectId, "projectId is required");
        connection.provider = RepositoryProvider.GITHUB;
        connection.repositoryOwner = requiredText(owner, OWNER_LIMIT, "owner");
        connection.repositoryName = requiredText(repositoryName, NAME_LIMIT, "repositoryName");
        connection.repositoryUrl = requiredText(repositoryUrl, URL_LIMIT, "repositoryUrl");
        connection.defaultBranch = requiredText(defaultBranch, BRANCH_LIMIT, "defaultBranch");
        connection.connectedBy = Objects.requireNonNull(connectedBy, "connectedBy is required");
        return connection;
    }

    /** Replaces the link's target entirely (a fresh connect); {@code connectedBy}/{@code connectedAt} are kept. */
    public void update(String owner, String repositoryName, String repositoryUrl, String defaultBranch) {
        this.repositoryOwner = requiredText(owner, OWNER_LIMIT, "owner");
        this.repositoryName = requiredText(repositoryName, NAME_LIMIT, "repositoryName");
        this.repositoryUrl = requiredText(repositoryUrl, URL_LIMIT, "repositoryUrl");
        this.defaultBranch = requiredText(defaultBranch, BRANCH_LIMIT, "defaultBranch");
    }

    @PrePersist
    private void beforeInsert() {
        connectedAt = Instant.now();
        updatedAt = connectedAt;
    }

    @PreUpdate
    private void beforeUpdate() {
        updatedAt = Instant.now();
    }

    private static String requiredText(String value, int maxLength, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " is required");
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return normalized;
    }

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public RepositoryProvider getProvider() { return provider; }
    public String getRepositoryUrl() { return repositoryUrl; }
    public String getRepositoryOwner() { return repositoryOwner; }
    public String getRepositoryName() { return repositoryName; }
    public String getDefaultBranch() { return defaultBranch; }
    public UUID getConnectedBy() { return connectedBy; }
    public Instant getConnectedAt() { return connectedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
