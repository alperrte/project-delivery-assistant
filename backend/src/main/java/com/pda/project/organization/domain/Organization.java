package com.pda.project.organization.domain;

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
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "organizations",
        uniqueConstraints = @UniqueConstraint(name = "uk_organizations_slug", columnNames = "slug"),
        indexes = @Index(name = "ix_organizations_archived_at", columnList = "archived_at"))
public class Organization {

    private static final int NAME_LIMIT = 160;
    private static final int SLUG_LIMIT = 100;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = NAME_LIMIT)
    private String name;

    @Column(nullable = false, length = SLUG_LIMIT)
    private String slug;

    @Column(length = 2000)
    private String description;

    @Column(name = "owner_user_id", nullable = false, updatable = false)
    private UUID ownerUserId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrganizationStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Organization() {
    }

    public static Organization create(String name, String slug, String description, UUID ownerUserId) {
        Organization organization = new Organization();
        organization.name = requiredText(name, NAME_LIMIT, "name");
        organization.slug = validSlug(slug);
        organization.description = optionalText(description, 2000, "description");
        organization.ownerUserId = Objects.requireNonNull(ownerUserId, "ownerUserId is required");
        organization.status = OrganizationStatus.ACTIVE;
        return organization;
    }

    public void updateDetails(String name, String description) {
        if (archivedAt != null) {
            throw new IllegalStateException("Archived organizations cannot be changed");
        }
        String validName = requiredText(name, NAME_LIMIT, "name");
        String validDescription = optionalText(description, 2000, "description");
        this.name = validName;
        this.description = validDescription;
    }

    public void archive() {
        if (archivedAt == null) {
            archivedAt = Instant.now();
            status = OrganizationStatus.ARCHIVED;
        }
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
    public UUID getOwnerUserId() { return ownerUserId; }
    public OrganizationStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getArchivedAt() { return archivedAt; }
}
