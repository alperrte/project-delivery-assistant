package com.pda.project.domain.entity;

import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectType;
import com.pda.project.domain.enums.ProjectVisibility;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "projects",
        uniqueConstraints = @UniqueConstraint(name = "uk_projects_slug", columnNames = "slug"),
        indexes = {
                @Index(name = "ix_projects_archived_at", columnList = "archived_at"),
                @Index(name = "ix_projects_organization_active", columnList = "organization_id, archived_at")
        })
public class Project {

    private static final int NAME_LIMIT = 160;
    private static final int SLUG_LIMIT = 100;
    private static final int TAGLINE_LIMIT = 120;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = NAME_LIMIT)
    private String name;

    @Column(nullable = false, length = SLUG_LIMIT)
    private String slug;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectPriority priority;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "target_end_date")
    private LocalDate targetEndDate;

    @Column(name = "project_goal", length = 2000)
    private String projectGoal;

    // V1 stores a short free-form description; structured technology tags are a separate decision.
    @Column(name = "tech_stack", length = 1000)
    private String techStack;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProjectVisibility visibility;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "project_type", nullable = false, length = 16)
    private ProjectType projectType = ProjectType.OTHER;

    @Column(length = TAGLINE_LIMIT)
    private String tagline;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    /** Set whenever a logo is stored; doubles as the cache-busting version of the logo URL. Null means no logo. */
    @Column(name = "logo_updated_at")
    private Instant logoUpdatedAt;

    @Column(name = "banner_updated_at")
    private Instant bannerUpdatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Project() {
    }

    public static Project create(String name, String slug, String description, UUID createdBy) {
        return create(name, slug, description, createdBy, null);
    }

    public static Project create(String name, String slug, String description, UUID createdBy,
                                 UUID organizationId) {
        return create(name, slug, description, createdBy, organizationId, null, null, null);
    }

    public static Project create(String name, String slug, String description, UUID createdBy,
                                 UUID organizationId, ProjectType projectType, String tagline, String techStack) {
        Project project = new Project();
        project.name = requiredText(name, NAME_LIMIT, "name");
        project.slug = validSlug(slug);
        project.description = optionalText(description, 2000, "description");
        project.createdBy = Objects.requireNonNull(createdBy, "createdBy is required");
        project.updatedBy = createdBy;
        project.organizationId = organizationId;
        project.projectType = projectType == null ? ProjectType.OTHER : projectType;
        project.tagline = optionalText(tagline, TAGLINE_LIMIT, "tagline");
        project.techStack = optionalText(techStack, 1000, "techStack");
        project.status = ProjectStatus.PLANNING;
        project.priority = ProjectPriority.MEDIUM;
        project.visibility = ProjectVisibility.PRIVATE;
        return project;
    }

    /** Type and tagline are edited together with the other details; a null type keeps the current one. */
    public void updateIdentity(ProjectType projectType, String tagline) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        String validTagline = optionalText(tagline, TAGLINE_LIMIT, "tagline");
        if (projectType != null) {
            this.projectType = projectType;
        }
        this.tagline = validTagline;
    }

    /** Records who changed the project last; the timestamp itself is maintained by {@code @PreUpdate}. */
    public void touch(UUID actor) {
        this.updatedBy = Objects.requireNonNull(actor, "actor is required");
    }

    public void logoStored(UUID actor, Instant at) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        this.logoUpdatedAt = Objects.requireNonNull(at, "at is required");
        touch(actor);
    }

    public void logoRemoved(UUID actor) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        this.logoUpdatedAt = null;
        touch(actor);
    }

    public void bannerStored(UUID actor, Instant at) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        this.bannerUpdatedAt = Objects.requireNonNull(at, "at is required");
        touch(actor);
    }

    public void bannerRemoved(UUID actor) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        this.bannerUpdatedAt = null;
        touch(actor);
    }

    public void updateDetails(String name, String description, ProjectPriority priority,
                              LocalDate startDate, LocalDate targetEndDate, String projectGoal,
                              String techStack, UUID organizationId) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        String validName = requiredText(name, NAME_LIMIT, "name");
        String validDescription = optionalText(description, 2000, "description");
        String validGoal = optionalText(projectGoal, 2000, "projectGoal");
        String validTechStack = optionalText(techStack, 1000, "techStack");
        ProjectPriority validPriority = Objects.requireNonNull(priority, "priority is required");
        if (startDate != null && targetEndDate != null && targetEndDate.isBefore(startDate)) {
            throw new IllegalArgumentException("targetEndDate cannot precede startDate");
        }
        this.name = validName;
        this.description = validDescription;
        this.priority = validPriority;
        this.startDate = startDate;
        this.targetEndDate = targetEndDate;
        this.projectGoal = validGoal;
        this.techStack = validTechStack;
        this.organizationId = organizationId;
    }

    public void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
            status = ProjectStatus.ARCHIVED;
        }
    }

    /**
     * Moves between the operational statuses (PLANNING/ACTIVE/ON_HOLD/COMPLETED). ARCHIVED is reached only through
     * {@link #archive()}, never through this method, so archiving always carries its own {@code archivedAt} and
     * stays the one well-defined path out of the operational lifecycle (V1 has no un-archiving).
     */
    public void changeStatus(ProjectStatus newStatus) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived projects cannot be changed");
        }
        Objects.requireNonNull(newStatus, "status is required");
        if (newStatus == ProjectStatus.ARCHIVED) {
            throw new IllegalArgumentException("Use archive() to archive a project");
        }
        this.status = newStatus;
    }

    @PrePersist
    private void beforeInsert() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    private void beforeUpdate() {
        updatedAt = Instant.now();
    }

    private static String requiredText(String value, int maxLength, String field) {
        String normalized = optionalText(value, maxLength, field);
        if (normalized == null) {
            throw new IllegalArgumentException(field + " is required");
        }
        return normalized;
    }

    private static String optionalText(String value, int maxLength, String field) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " exceeds " + maxLength + " characters");
        }
        return normalized;
    }

    private static String validSlug(String value) {
        String slug = requiredText(value, SLUG_LIMIT, "slug").toLowerCase(Locale.ROOT);
        if (!slug.matches("[a-z0-9]+(?:-[a-z0-9]+)*")) {
            throw new IllegalArgumentException("slug must contain lowercase letters, digits and single hyphens");
        }
        return slug;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getSlug() { return slug; }
    public String getDescription() { return description; }
    public ProjectStatus getStatus() { return status; }
    public ProjectPriority getPriority() { return priority; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getTargetEndDate() { return targetEndDate; }
    public String getProjectGoal() { return projectGoal; }
    public String getTechStack() { return techStack; }
    public ProjectVisibility getVisibility() { return visibility; }
    public UUID getOrganizationId() { return organizationId; }
    public ProjectType getProjectType() { return projectType; }
    public String getTagline() { return tagline; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public UUID getUpdatedBy() { return updatedBy; }
    public Instant getLogoUpdatedAt() { return logoUpdatedAt; }
    public Instant getBannerUpdatedAt() { return bannerUpdatedAt; }
    public Instant getArchivedAt() { return archivedAt; }
}
