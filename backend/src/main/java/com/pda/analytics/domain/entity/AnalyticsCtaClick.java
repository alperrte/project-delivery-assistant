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

/** One click on an allow-listed call to action: its id and when the server saw it. */
@Entity
@Table(name = "analytics_cta_clicks")
public class AnalyticsCtaClick {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false, updatable = false)
    private UUID sessionId;

    @Column(name = "cta_id", nullable = false, updatable = false, length = 40)
    private String ctaId;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private Instant occurredAt;

    protected AnalyticsCtaClick() {
    }

    public static AnalyticsCtaClick of(UUID sessionId, String ctaId, Instant occurredAt) {
        AnalyticsCtaClick click = new AnalyticsCtaClick();
        click.sessionId = Objects.requireNonNull(sessionId, "sessionId is required");
        click.ctaId = Objects.requireNonNull(ctaId, "ctaId is required");
        click.occurredAt = Objects.requireNonNull(occurredAt, "occurredAt is required");
        return click;
    }

    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getCtaId() { return ctaId; }
    public Instant getOccurredAt() { return occurredAt; }
}
