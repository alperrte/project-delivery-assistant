package com.pda.analytics.application.service;

import com.pda.analytics.domain.entity.AnalyticsPageView;
import com.pda.analytics.domain.entity.AnalyticsSession;
import com.pda.analytics.domain.enums.AnalyticsEventType;
import com.pda.analytics.infrastructure.repository.AnalyticsPageViewRepository;
import com.pda.analytics.infrastructure.repository.AnalyticsSessionRepository;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Applies one validated browser event. The server is the authority: it uses its own clock, derives the traffic source
 * from the first page of a session only, and credits active time only as far as elapsed time allows. Nothing here
 * knows who the visitor is.
 */
@Service
public class AnalyticsIngestService {

    /** The most active time one ENGAGEMENT event may add. The browser reports about every 15 seconds. */
    static final int MAX_ENGAGEMENT_PER_EVENT = 120;
    /** Slack for the browser's coarse timers when comparing reported time with elapsed time. */
    static final int ENGAGEMENT_TOLERANCE_SECONDS = 5;

    private final AnalyticsSessionRepository sessions;
    private final AnalyticsPageViewRepository pageViews;
    private final Clock clock;
    private final String ownHost;

    public AnalyticsIngestService(AnalyticsSessionRepository sessions, AnalyticsPageViewRepository pageViews,
                                  Clock clock, @Value("${FRONTEND_URL:}") String frontendUrl) {
        this.sessions = sessions;
        this.pageViews = pageViews;
        this.clock = clock;
        this.ownHost = hostOf(frontendUrl);
    }

    public record Event(AnalyticsEventType type, UUID visitorId, UUID sessionId, String path, String referrerHost,
                        String utmSource, String utmMedium, String utmCampaign, Integer engagedSeconds,
                        int consentVersion) {}

    /** The browser sent an engagement event for a session this server never opened (or that was dropped). */
    public static class UnknownSessionException extends RuntimeException {
        public UnknownSessionException() {
            super("Unknown analytics session");
        }
    }

    /** The session belongs to a different visitor id than the one on the event. */
    public static class VisitorMismatchException extends RuntimeException {
        public VisitorMismatchException() {
            super("Visitor does not match the session");
        }
    }

    @Transactional
    public void record(Event event) {
        Instant now = clock.instant();
        if (event.type() == AnalyticsEventType.PAGE_VIEW) {
            recordPageView(event, now);
        } else {
            recordEngagement(event, now);
        }
    }

    private void recordPageView(Event event, Instant now) {
        var source = TrafficSourceClassifier.classify(event.referrerHost(), event.utmSource(), event.utmMedium(),
                event.utmCampaign(), ownHost);
        sessions.insertIfAbsent(event.sessionId(), event.visitorId(), now, event.path(), source.type().name(),
                source.referrerDomain(), source.utmSource(), source.utmMedium(), source.utmCampaign(),
                event.consentVersion());
        AnalyticsSession session = sessions.lockById(event.sessionId()).orElseThrow(UnknownSessionException::new);
        if (!session.belongsTo(event.visitorId())) {
            throw new VisitorMismatchException();
        }
        if (session.recordPageView(now)) {
            pageViews.save(AnalyticsPageView.of(session.getId(), event.path(), now));
        }
    }

    private void recordEngagement(Event event, Instant now) {
        if (event.engagedSeconds() == null) {
            throw new IllegalArgumentException("engagedSeconds is required for ENGAGEMENT");
        }
        AnalyticsSession session = sessions.lockById(event.sessionId()).orElseThrow(UnknownSessionException::new);
        if (!session.belongsTo(event.visitorId())) {
            throw new VisitorMismatchException();
        }
        session.addEngagement(event.engagedSeconds(), now, MAX_ENGAGEMENT_PER_EVENT, ENGAGEMENT_TOLERANCE_SECONDS);
    }

    private static String hostOf(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            return URI.create(url.strip()).getHost();
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
