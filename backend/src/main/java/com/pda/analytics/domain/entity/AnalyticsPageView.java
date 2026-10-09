package com.pda.analytics.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/** One page view: the route template that was visited (never a query string or an id) and when the server saw it. */
@Entity
@Table(name = "analytics_page_views")
public class AnalyticsPageView {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false, updatable = false)
    private UUID sessionId;

    @Column(nullable = false, updatable = false, length = 200)
    private String path;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected AnalyticsPageView() {
    }

    public static AnalyticsPageView of(UUID sessionId, String path, Instant occurredAt) {
        AnalyticsPageView view = new AnalyticsPageView();
        view.sessionId = Objects.requireNonNull(sessionId, "sessionId is required");
        view.path = Objects.requireNonNull(path, "path is required");
        view.occurredAt = Objects.requireNonNull(occurredAt, "occurredAt is required");
        return view;
    }

    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getPath() { return path; }
    public Instant getOccurredAt() { return occurredAt; }
}
