package com.pda.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.pda.shared.HttpErrorCounters.Counts;
import com.pda.shared.web.HttpErrorCountingFilter;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

/** The 24-hour window of 4xx/5xx answers: what counts, what rolls out, and that the filter never reads the request. */
class HttpErrorCountersTest {

    /** A clock the test moves. */
    private static final class Moving extends Clock {
        final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-10T12:30:00Z"));

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
        void advance(Duration by) { now.updateAndGet(at -> at.plus(by)); }
    }

    private final Moving clock = new Moving();
    private final HttpErrorCounters counters = new HttpErrorCounters(clock);

    @Test
    void onlyClientAndServerErrorStatusesAreCounted() {
        for (int status : new int[] {200, 201, 204, 301, 304, 399, 600}) {
            counters.count(status);
        }
        assertEquals(new Counts(0, 0), counters.last24Hours());
        for (int status : new int[] {400, 401, 403, 404, 499}) {
            counters.count(status);
        }
        for (int status : new int[] {500, 502, 503, 599}) {
            counters.count(status);
        }
        assertEquals(new Counts(5, 4), counters.last24Hours());
    }

    @Test
    void anAnswerLeavesTheWindowAfterTwentyFourHourBuckets() {
        counters.count(500);
        clock.advance(Duration.ofHours(23));
        counters.count(404);
        assertEquals(new Counts(1, 1), counters.last24Hours());
        // 12:30 + 24 h: the hour of the first answer (12:00-13:00) is 24 buckets old and gone.
        clock.advance(Duration.ofHours(1));
        assertEquals(new Counts(1, 0), counters.last24Hours());
        clock.advance(Duration.ofHours(23));
        assertEquals(new Counts(0, 0), counters.last24Hours());
    }

    @Test
    void aBucketIsReusedByTheSameHourOfTheNextDayWithoutKeepingTheOldCount() {
        counters.count(500);
        clock.advance(Duration.ofHours(24));
        counters.count(500);
        assertEquals(new Counts(0, 1), counters.last24Hours());
    }

    @Test
    void theFilterCountsTheFinalStatusAndAnEscapedExceptionAsServerError() throws Exception {
        HttpErrorCountingFilter filter = new HttpErrorCountingFilter(counters);
        MockHttpServletResponse notFound = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/api/v1/secret?token=abc"), notFound,
                (request, response) -> ((MockHttpServletResponse) response).setStatus(404));
        MockHttpServletResponse ok = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/x"), ok, new MockFilterChain());
        assertEquals(new Counts(1, 0), counters.last24Hours());

        assertThrows(IllegalStateException.class, () -> filter.doFilter(new MockHttpServletRequest("GET", "/boom"),
                new MockHttpServletResponse(), (request, response) -> { throw new IllegalStateException("x"); }));
        assertThrows(IOException.class, () -> filter.doFilter(new MockHttpServletRequest("GET", "/io"),
                new MockHttpServletResponse(), (request, response) -> { throw new IOException("x"); }));
        assertThrows(ServletException.class, () -> filter.doFilter(new MockHttpServletRequest("GET", "/servlet"),
                new MockHttpServletResponse(), (request, response) -> { throw new ServletException("x"); }));
        assertEquals(new Counts(1, 3), counters.last24Hours());
    }
}
