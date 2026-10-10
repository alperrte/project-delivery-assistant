package com.pda.analytics.domain.entity;

import com.pda.analytics.domain.enums.AnalyticsErrorKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One client-side failure: the route template it happened on and its kind - never a message, stack, URL or id. */
@Entity
@Table(name = "analytics_client_errors")
public class AnalyticsClientError {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false, updatable = false)
    private UUID sessionId;

    @Column(nullable = false, updatable = false, length = 200)
    private String path;

    @Enumerated(EnumType.STRING)
    @Column(name = "error_kind", nullable = false, updatable = false, length = 24)
    private AnalyticsErrorKind errorKind;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected AnalyticsClientError() {
    }

    public static AnalyticsClientError of(UUID sessionId, String path, AnalyticsErrorKind kind, Instant occurredAt) {
        AnalyticsClientError error = new AnalyticsClientError();
        error.sessionId = Objects.requireNonNull(sessionId, "sessionId is required");
        error.path = Objects.requireNonNull(path, "path is required");
        error.errorKind = Objects.requireNonNull(kind, "kind is required");
        error.occurredAt = Objects.requireNonNull(occurredAt, "occurredAt is required");
        return error;
    }

    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getPath() { return path; }
    public AnalyticsErrorKind getErrorKind() { return errorKind; }
    public Instant getOccurredAt() { return occurredAt; }
}
