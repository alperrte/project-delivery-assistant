package com.pda.analytics.domain.entity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnalyticsSessionTest {

    private static final Instant START = Instant.parse("2026-10-09T10:00:00Z");

    private static AnalyticsSession session(Instant lastSeen) throws Exception {
        var constructor = AnalyticsSession.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        AnalyticsSession session = constructor.newInstance();
        set(session, "id", UUID.randomUUID());
        set(session, "visitorId", UUID.randomUUID());
        set(session, "startedAt", lastSeen);
        set(session, "lastSeenAt", lastSeen);
        return session;
    }

    private static void set(Object target, String name, Object value) throws Exception {
        Field field = AnalyticsSession.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(target, value);
    }

    @Test
    void engagementIsCappedByTheElapsedTimeSinceTheLastEvent() throws Exception {
        AnalyticsSession session = session(START);
        // 15 s really passed: 15 are credited.
        assertEquals(15, session.addEngagement(15, START.plusSeconds(15), 120, 5));
        // The browser claims 100 s but only 10 s passed (plus 5 s tolerance): 15 at most.
        assertEquals(15, session.addEngagement(100, START.plusSeconds(25), 120, 5));
        assertEquals(30, session.getEngagedSeconds());
    }

    @Test
    void engagementIsCappedPerEventAndPerSession() throws Exception {
        AnalyticsSession session = session(START);
        // A long silence does not let one event claim more than the per-event limit.
        assertEquals(120, session.addEngagement(600, START.plusSeconds(10_000), 120, 5));
        AnalyticsSession nearCeiling = session(START);
        Instant at = START;
        for (int i = 0; i < 400; i++) {
            at = at.plusSeconds(120);
            nearCeiling.addEngagement(120, at, 120, 5);
        }
        assertEquals(AnalyticsSession.MAX_ENGAGED_SECONDS, nearCeiling.getEngagedSeconds());
    }

    @Test
    void negativeOrBackwardsTimeNeverCreditsAnything() throws Exception {
        AnalyticsSession session = session(START);
        assertEquals(0, session.addEngagement(-10, START.plusSeconds(60), 120, 5));
        // A second event "from the past" (clock skew) only earns the tolerance.
        assertEquals(5, session.addEngagement(60, START.minusSeconds(30), 120, 5));
        assertEquals(START.plusSeconds(60), session.getLastSeenAt());
    }

    @Test
    void pageViewsStopAtTheSessionLimit() throws Exception {
        AnalyticsSession session = session(START);
        for (int i = 0; i < AnalyticsSession.MAX_PAGE_VIEWS; i++) {
            assertTrue(session.recordPageView(START.plusSeconds(i)));
        }
        assertFalse(session.recordPageView(START.plusSeconds(10_000)));
        assertEquals(AnalyticsSession.MAX_PAGE_VIEWS, session.getPageViews());
    }
}
