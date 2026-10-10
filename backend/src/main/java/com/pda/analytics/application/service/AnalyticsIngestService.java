package com.pda.analytics.application.service;

import com.pda.analytics.domain.entity.AnalyticsClientError;
import com.pda.analytics.domain.entity.AnalyticsCtaClick;
import com.pda.analytics.domain.entity.AnalyticsPageView;
import com.pda.analytics.domain.entity.AnalyticsSession;
import com.pda.analytics.domain.enums.AnalyticsCtaId;
import com.pda.analytics.domain.enums.AnalyticsErrorKind;
import com.pda.analytics.domain.enums.AnalyticsEventType;
import com.pda.analytics.infrastructure.repository.AnalyticsClientErrorRepository;
import com.pda.analytics.infrastructure.repository.AnalyticsCtaClickRepository;
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
 * knows who the visitor is. CTA clicks and client errors are accepted only for a session the server already knows (it
 * inherits that session consent version), only with an id from a fixed list, and only up to a per-session limit.
 */
@Service
public class AnalyticsIngestService {

    /** The most active time one ENGAGEMENT event may add. The browser reports about every 15 seconds. */
    static final int MAX_ENGAGEMENT_PER_EVENT = 120;
    /** Slack for the browser coarse timers when comparing reported time with elapsed time. */
    static final int ENGAGEMENT_TOLERANCE_SECONDS = 5;
    /** Call-to-action clicks kept per session; further ones are dropped. */
    public static final int MAX_CTA_CLICKS_PER_SESSION = 100;
    /** Client errors kept per session; further ones are dropped (an error loop must not fill the table). */
    public static final int MAX_CLIENT_ERRORS_PER_SESSION = 50;

    private final AnalyticsSessionRepository sessions;
    private final AnalyticsPageViewRepository pageViews;
    private final AnalyticsCtaClickRepository ctaClicks;
    private final AnalyticsClientErrorRepository clientErrors;
    private final Clock clock;
    private final String ownHost;

    public AnalyticsIngestService(AnalyticsSessionRepository sessions, AnalyticsPageViewRepository pageViews,
                                  AnalyticsCtaClickRepository ctaClicks, AnalyticsClientErrorRepository clientErrors,
                                  Clock clock, @Value("${FRONTEND_URL:}") String frontendUrl) {
        this.sessions = sessions;
        this.pageViews = pageViews;
        this.ctaClicks = ctaClicks;
        this.clientErrors = clientErrors;
        this.clock = clock;
        this.ownHost = hostOf(frontendUrl);
    }

    /**
     * @param ctaId     CTA_CLICK only, the wire id (checked against {@link AnalyticsCtaId})
     * @param errorKind CLIENT_ERROR only, the wire id (checked against {@link AnalyticsErrorKind})
     */
    public record Event(AnalyticsEventType type, UUID visitorId, UUID sessionId, String path, String referrerHost,
                        String utmSource, String utmMedium, String utmCampaign, Integer engagedSeconds,
                        int consentVersion, String ctaId, String errorKind) {}

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
        switch (event.type()) {
            case PAGE_VIEW -> recordPageView(event, now);
            case ENGAGEMENT -> recordEngagement(event, now);
            case CTA_CLICK -> recordCtaClick(event, now);
            case CLIENT_ERROR -> recordClientError(event, now);
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
        AnalyticsSession session = lockedSessionOf(event);
        session.addEngagement(event.engagedSeconds(), now, MAX_ENGAGEMENT_PER_EVENT, ENGAGEMENT_TOLERANCE_SECONDS);
    }

    private void recordCtaClick(Event event, Instant now) {
        AnalyticsCtaId cta = AnalyticsCtaId.parse(event.ctaId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown call-to-action id"));
        AnalyticsSession session = lockedSessionOf(event);
        if (ctaClicks.countBySessionId(session.getId()) < MAX_CTA_CLICKS_PER_SESSION) {
            ctaClicks.save(AnalyticsCtaClick.of(session.getId(), cta.id(), now));
        }
    }

    private void recordClientError(Event event, Instant now) {
        AnalyticsErrorKind kind = AnalyticsErrorKind.parse(event.errorKind())
                .orElseThrow(() -> new IllegalArgumentException("Unknown client error kind"));
        AnalyticsSession session = lockedSessionOf(event);
        if (clientErrors.countBySessionId(session.getId()) < MAX_CLIENT_ERRORS_PER_SESSION) {
            clientErrors.save(AnalyticsClientError.of(session.getId(), event.path(), kind, now));
        }
    }

    /** The row-locked session of the event; concurrent events of one session are applied one after the other. */
    private AnalyticsSession lockedSessionOf(Event event) {
        AnalyticsSession session = sessions.lockById(event.sessionId()).orElseThrow(UnknownSessionException::new);
        if (!session.belongsTo(event.visitorId())) {
            throw new VisitorMismatchException();
        }
        return session;
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
