package com.pda.audit.application.service;

import com.pda.shared.BatchPurge;
import com.pda.shared.ScheduledJobRegistry;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Daily purge of audit events older than {@code pda.retention.audit-months} (default 24). Logs only a count. */
@Component
public class AuditRetentionJob {

    static final String JOB = "retention.audit";
    private static final Logger log = LoggerFactory.getLogger(AuditRetentionJob.class);

    private final BatchPurge purge;
    private final ScheduledJobRegistry registry;
    private final Clock clock;
    private final int months;
    private final int batchSize;

    public AuditRetentionJob(BatchPurge purge, ScheduledJobRegistry registry, Clock clock,
                             @Value("${pda.retention.audit-months:24}") int months,
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
            registry.failure(JOB);
            log.warn("Audit retention purge failed", exception);
        }
    }

    public long run(Instant now) {
        long removed = purge.deleteInBatches("admin_audit_events", "occurred_at < :cutoff",
                BatchPurge.monthsBefore(now, months), batchSize);
        registry.success(JOB, removed);
        if (removed > 0) log.info("Retention: removed {} audit event(s)", removed);
        return removed;
    }
}
