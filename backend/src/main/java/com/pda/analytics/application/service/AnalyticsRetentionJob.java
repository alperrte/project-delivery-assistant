package com.pda.analytics.application.service;

import com.pda.shared.BatchPurge;
import com.pda.shared.ScheduledJobRegistry;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily purge of visit analytics older than {@code pda.retention.analytics-months} (default 12). A session goes when its
 * last activity is older than the window; its page views, call-to-action clicks and client errors go with it (ON DELETE
 * CASCADE). Logs only the number of removed sessions.
 */
@Component
public class AnalyticsRetentionJob {

    static final String JOB = "retention.analytics";
    private static final Logger log = LoggerFactory.getLogger(AnalyticsRetentionJob.class);

    private final BatchPurge purge;
    private final ScheduledJobRegistry registry;
    private final Clock clock;
    private final int months;
    private final int batchSize;

    public AnalyticsRetentionJob(BatchPurge purge, ScheduledJobRegistry registry, Clock clock,
                                 @Value("${pda.retention.analytics-months:12}") int months,
                                 @Value("${pda.retention.batch-size:1000}") int batchSize) {
        this.purge = purge;
        this.registry = registry;
        this.clock = clock;
        this.months = Math.max(1, months);
        this.batchSize = batchSize;
        registry.register(JOB);
    }

    @Scheduled(cron = "${pda.retention.cron:0 30 3 * * *}", zone = "UTC")
    void scheduled() {
        try {
            run(clock.instant());
        } catch (RuntimeException exception) {
            // The next daily run finds the same rows again.
            registry.failure(JOB);
            log.warn("Analytics retention purge failed", exception);
        }
    }

    /** Removes the sessions that were last active before the window ends at {@code now}; returns how many. */
    public long run(Instant now) {
        long removed = purge.deleteInBatches("analytics_sessions", "last_seen_at < :cutoff",
                BatchPurge.monthsBefore(now, months), batchSize);
        registry.success(JOB, removed);
        if (removed > 0) log.info("Retention: removed {} analytics session(s)", removed);
        return removed;
    }
}
