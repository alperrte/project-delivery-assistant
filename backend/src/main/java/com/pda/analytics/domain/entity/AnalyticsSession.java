package com.pda.analytics.domain.entity;

import com.pda.analytics.domain.enums.TrafficSourceType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * One consented visit session. Anonymous on purpose: only random identifiers made in the browser, the route the visit
 * started on, where it came from and how long the person was actively there. There is no user, address or query data.
 * The row is created by an insert-if-absent statement (see the repository) so two first events cannot collide.
 */
@Entity
@Table(name = "analytics_sessions")
public class AnalyticsSession {

    /** A session can never be credited with more active time than this (six hours). */
    public static final int MAX_ENGAGED_SECONDS = 21_600;
    /** Page views kept per session; further ones are dropped. */
    public static final int MAX_PAGE_VIEWS = 500;

    @Id
    private UUID id;

    @Column(name = "visitor_id", nullable = false, updatable = false)
    private UUID visitorId;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "last_seen_at", nullable = false)
    private Instant lastSeenAt;

    @Column(name = "engaged_seconds", nullable = false)
    private int engagedSeconds;

    @Column(name = "page_views", nullable = false)
    private int pageViews;

    @Column(name = "entry_path", nullable = false, updatable = false, length = 200)
    private String entryPath;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, updatable = false, length = 16)
    private TrafficSourceType sourceType;

    @Column(name = "referrer_domain", updatable = false, length = 100)
    private String referrerDomain;

    @Column(name = "utm_source", updatable = false, length = 100)
    private String utmSource;

    @Column(name = "utm_medium", updatable = false, length = 100)
    private String utmMedium;

    @Column(name = "utm_campaign", updatable = false, length = 100)
    private String utmCampaign;

    @Column(name = "consent_version", nullable = false, updatable = false)
    private int consentVersion;

    protected AnalyticsSession() {
    }

    public boolean belongsTo(UUID visitor) {
        return visitorId.equals(visitor);
    }

    /** Counts one page view; false when this session already reached its limit (the view is then not stored). */
    public boolean recordPageView(Instant at) {
        if (pageViews >= MAX_PAGE_VIEWS) {
            return false;
        }
        pageViews++;
        touch(at);
        return true;
    }

    /**
     * Credits active time reported by the browser, bounded by what the server can believe: at most the requested
     * seconds, never more than the per-event limit, never more than the time that really passed since the session was
     * last heard from (plus a small tolerance for clock granularity) and never beyond the session ceiling. Returns
     * the seconds credited.
     */
    public int addEngagement(int requested, Instant at, int perEventLimit, int toleranceSeconds) {
        long elapsed = Math.max(0, at.getEpochSecond() - lastSeenAt.getEpochSecond());
        long allowed = Math.min(Math.min(Math.max(requested, 0), perEventLimit), elapsed + toleranceSeconds);
        allowed = Math.min(allowed, MAX_ENGAGED_SECONDS - engagedSeconds);
        engagedSeconds += (int) allowed;
        touch(at);
        return (int) allowed;
    }

    private void touch(Instant at) {
        if (at.isAfter(lastSeenAt)) {
            lastSeenAt = at;
        }
    }

    public UUID getId() { return id; }
    public UUID getVisitorId() { return visitorId; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getLastSeenAt() { return lastSeenAt; }
    public int getEngagedSeconds() { return engagedSeconds; }
    public int getPageViews() { return pageViews; }
    public String getEntryPath() { return entryPath; }
    public TrafficSourceType getSourceType() { return sourceType; }
    public String getReferrerDomain() { return referrerDomain; }
    public String getUtmSource() { return utmSource; }
    public String getUtmMedium() { return utmMedium; }
    public String getUtmCampaign() { return utmCampaign; }
    public int getConsentVersion() { return consentVersion; }
}
