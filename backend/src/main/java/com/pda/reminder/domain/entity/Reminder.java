package com.pda.reminder.domain.entity;

import com.pda.reminder.domain.enums.ReminderScope;
import com.pda.reminder.domain.enums.ReminderType;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Objects;
import java.util.UUID;

/**
 * A calendar entry of one project. It is not a task: no status, assignee or priority. The date is a plain
 * {@link LocalDate} (and the optional time a {@link LocalTime}) on purpose, so a reminder for "3 October" can never
 * slide to another day through a timezone conversion. Visibility and edit rights come from {@link #getScope()}.
 */
@Entity
@Table(name = "project_reminders",
        indexes = @Index(name = "ix_project_reminders_project_date", columnList = "project_id, reminder_date"))
public class Reminder {

    public static final int TITLE_LIMIT = 100;
    public static final int DESCRIPTION_LIMIT = 500;

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "creator_user_id", nullable = false, updatable = false)
    private UUID creatorUserId;

    @Column(nullable = false, length = TITLE_LIMIT)
    private String title;

    @Column(length = DESCRIPTION_LIMIT)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReminderType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private ReminderScope scope;

    @Column(name = "reminder_date", nullable = false)
    private LocalDate reminderDate;

    @Column(name = "reminder_time")
    private LocalTime reminderTime;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Reminder() {
        // JPA
    }

    public static Reminder create(UUID projectId, UUID creatorUserId, ReminderScope scope, ReminderType type,
                                  String title, String description, LocalDate date, LocalTime time) {
        Reminder reminder = new Reminder();
        reminder.projectId = Objects.requireNonNull(projectId, "projectId is required");
        reminder.creatorUserId = Objects.requireNonNull(creatorUserId, "creatorUserId is required");
        reminder.scope = Objects.requireNonNull(scope, "scope is required");
        reminder.apply(type, title, description, date, time);
        return reminder;
    }

    /** Replaces the editable fields. The scope, project and creator are fixed for the life of the reminder. */
    public void edit(ReminderType type, String title, String description, LocalDate date, LocalTime time) {
        apply(type, title, description, date, time);
    }

    private void apply(ReminderType type, String title, String description, LocalDate date, LocalTime time) {
        // Validate everything first so a rejected edit never leaves the entity half changed.
        ReminderType checkedType = Objects.requireNonNull(type, "type is required");
        String checkedTitle = requiredText(title, TITLE_LIMIT, "title");
        String checkedDescription = optionalText(description, DESCRIPTION_LIMIT, "description");
        LocalDate checkedDate = Objects.requireNonNull(date, "date is required");
        this.type = checkedType;
        this.title = checkedTitle;
        this.description = checkedDescription;
        this.reminderDate = checkedDate;
        this.reminderTime = time;
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

    public UUID getId() { return id; }
    public UUID getProjectId() { return projectId; }
    public UUID getCreatorUserId() { return creatorUserId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public ReminderType getType() { return type; }
    public ReminderScope getScope() { return scope; }
    public LocalDate getReminderDate() { return reminderDate; }
    public LocalTime getReminderTime() { return reminderTime; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
