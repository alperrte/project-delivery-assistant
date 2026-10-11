package com.pda.user.application.service;

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
 * Daily purge of sessions that can no longer be used: revoked or expired more than
 * {@code pda.retention.user-sessions-days} (default 30) days ago. Active sessions are never touched. Logs only a count.
 */
@Component
public class UserSessionRetentionJob {

    static final String JOB = "retention.user-sessions";
    private static final Logger log = LoggerFactory.getLogger(UserSessionRetentionJob.class);

    private final BatchPurge purge;
    private final ScheduledJobRegistry registry;
    private final Clock clock;
    private final int days;
    private final int batchSize;

    public UserSessionRetentionJob(BatchPurge purge, ScheduledJobRegistry registry, Clock clock,
                                   @Value("${pda.retention.user-sessions-days:30}") int days,
                                   @Value("${pda.retention.batch-size:1000}") int batchSize) {
        this.purge = purge;
        this.registry = registry;
        this.clock = clock;
        this.days = Math.max(1, days);
        this.batchSize = batchSize;
        registry.register(JOB);
    }

    @Scheduled(cron = "${pda.retention.cron:0 30 3 * * *}", zone = "UTC")
    void scheduled() {
        try {
            run(clock.instant());
        } catch (RuntimeException exception) {
            registry.failure(JOB);
            log.warn("Session retention purge failed", exception);
        }
    }

    public long run(Instant now) {
        long removed = purge.deleteInBatches("user_sessions", "expires_at < :cutoff OR revoked_at < :cutoff",
                BatchPurge.daysBefore(now, days), batchSize);
        registry.success(JOB, removed);
        if (removed > 0) log.info("Retention: removed {} ended session(s)", removed);
        return removed;
    }
}
