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
import java.net.URI;
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

    @Column(length = 1000)
    private String notes;

    @Column(length = 2048)
    private String website;
    @Column(name = "contact_email", length = 254)
    private String contactEmail;
    @Column(length = 200)
    private String location;
    @Column(name = "logo_key", length = 36)
    private String logoKey;
    @Column(name = "cover_image_key", length = 36)
    private String coverKey;

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

    public void updateProfile(String name, String description, String website, String contactEmail, String location) {
        updateProfile(name, description, website, contactEmail, location, null);
    }

    public void updateProfile(String name, String description, String website, String contactEmail, String location, String notes) {
        String validWebsite = optionalText(website, 2048, "website");
        if (validWebsite != null) {
            URI uri;
            try { uri = URI.create(validWebsite); } catch (IllegalArgumentException invalid) {
                throw new IllegalArgumentException("Invalid website");
            }
            if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || validWebsite.chars().anyMatch(Character::isISOControl)) {
                throw new IllegalArgumentException("Invalid website");
            }
        }
        String validEmail = optionalText(contactEmail, 254, "contactEmail");
        if (validEmail != null && !validEmail.matches("[^\\s@]+@[^\\s@]+")) {
            throw new IllegalArgumentException("Invalid contact email");
        }
        String validLocation = optionalText(location, 200, "location");
        String validNotes = optionalText(notes, 1000, "notes");
        updateDetails(name, description);
        this.website = validWebsite;
        this.contactEmail = validEmail;
        this.location = validLocation;
        this.notes = validNotes;
    }

    public void mediaStored(String kind, String key) {
        if (archivedAt != null) throw new IllegalStateException("Archived organization");
        if ("LOGO".equals(kind)) logoKey = key;
        else if ("COVER".equals(kind)) coverKey = key;
        else throw new IllegalArgumentException("Unknown media kind");
    }

    public String mediaKey(String kind) { return "LOGO".equals(kind) ? logoKey : coverKey; }
    public String getNotes() { return notes; }
    public String getWebsite() { return website; }
    public String getContactEmail() { return contactEmail; }
    public String getLocation() { return location; }
    public String getLogoKey() { return logoKey; }
    public String getCoverKey() { return coverKey; }

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
