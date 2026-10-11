package com.pda.shared;

import java.time.Clock;
import java.util.Arrays;
import org.springframework.stereotype.Component;

/**
 * Counts the HTTP answers of this process that were client errors (4xx) or server errors (5xx) over the last 24 hours,
 * for the administrator system status. It is fed by {@code HttpErrorCountingFilter}, which sees nothing but the final
 * status code: no path, address, header, cookie or body is read or kept, so it needs no consent and holds no personal
 * data. The window is built from 24 hourly buckets (the current hour plus the previous 23), in memory only; a restart
 * starts from zero.
 */
@Component
public class HttpErrorCounters {

    static final int HOURS = 24;

    /** Answers with status 400-499 and 500-599 inside the window. */
    public record Counts(long clientErrors, long serverErrors) {}

    private final Clock clock;
    private final long[] bucketHour = new long[HOURS];
    private final long[] client = new long[HOURS];
    private final long[] server = new long[HOURS];

    public HttpErrorCounters(Clock clock) {
        this.clock = clock;
        Arrays.fill(bucketHour, Long.MIN_VALUE);
    }

    /** Records one answer; statuses outside 400-599 are ignored. */
    public void count(int status) {
        if (status < 400 || status > 599) {
            return;
        }
        long hour = hourNow();
        int slot = (int) Math.floorMod(hour, (long) HOURS);
        synchronized (this) {
            if (bucketHour[slot] != hour) {
                bucketHour[slot] = hour;
                client[slot] = 0;
                server[slot] = 0;
            }
            if (status >= 500) {
                server[slot]++;
            } else {
                client[slot]++;
            }
        }
    }

    public synchronized Counts last24Hours() {
        long hour = hourNow();
        long clientTotal = 0;
        long serverTotal = 0;
        for (int slot = 0; slot < HOURS; slot++) {
            if (bucketHour[slot] > hour - HOURS && bucketHour[slot] <= hour) {
                clientTotal += client[slot];
                serverTotal += server[slot];
            }
        }
        return new Counts(clientTotal, serverTotal);
    }

    private long hourNow() {
        return Math.floorDiv(clock.instant().getEpochSecond(), 3600L);
    }
}
