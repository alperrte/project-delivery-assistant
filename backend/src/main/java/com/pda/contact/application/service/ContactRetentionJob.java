package com.pda.contact.application.service;

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
 * Daily purge of the contact delivery records and the stored support messages older than
 * {@code pda.retention.contact-months} (default 12), counted from the time the message arrived. Logs only counts.
 */
@Component
public class ContactRetentionJob {

    static final String JOB = "retention.contact";
    private static final Logger log = LoggerFactory.getLogger(ContactRetentionJob.class);

    private final BatchPurge purge;
    private final ScheduledJobRegistry registry;
    private final Clock clock;
    private final int months;
    private final int batchSize;

    public ContactRetentionJob(BatchPurge purge, ScheduledJobRegistry registry, Clock clock,
                               @Value("${pda.retention.contact-months:12}") int months,
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
            log.warn("Contact retention purge failed", exception);
        }
    }

    /** Returns the number of rows removed from both tables. */
    public long run(Instant now) {
        Instant cutoff = BatchPurge.monthsBefore(now, months);
        long deliveries = purge.deleteInBatches("contact_requests", "created_at < :cutoff", cutoff, batchSize);
        long messages = purge.deleteInBatches("support_requests", "created_at < :cutoff", cutoff, batchSize);
        registry.success(JOB, deliveries + messages);
        if (deliveries + messages > 0) {
            log.info("Retention: removed {} contact record(s) and {} support message(s)", deliveries, messages);
        }
        return deliveries + messages;
    }
}
