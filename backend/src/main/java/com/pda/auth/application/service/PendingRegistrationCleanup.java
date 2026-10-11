package com.pda.auth.application.service;

import com.pda.shared.ScheduledJobRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Cancels registrations whose code ran out unused (15 minutes), so the email and nickname become free again. */
@Component
class PendingRegistrationCleanup {
    private static final Logger log = LoggerFactory.getLogger(PendingRegistrationCleanup.class);

    static final String JOB = "auth.pending-registration-cleanup";

    private final RegistrationWorkflow registrations;
    private final ScheduledJobRegistry jobs;

    PendingRegistrationCleanup(RegistrationWorkflow registrations, ScheduledJobRegistry jobs) {
        this.registrations = registrations;
        this.jobs = jobs;
        jobs.register(JOB);
    }

    @Scheduled(fixedDelayString = "${pda.auth.pending-registration-cleanup-interval:PT1M}",
            initialDelayString = "${pda.auth.pending-registration-cleanup-interval:PT1M}")
    void purge() {
        try {
            int removed = registrations.purgeExpiredPending();
            jobs.success(JOB, removed);
            if (removed > 0) log.info("Cancelled {} unverified registration(s)", removed);
        } catch (RuntimeException exception) {
            // The next run picks the same rows up again.
            jobs.failure(JOB);
            log.warn("Unverified registration cleanup failed", exception);
        }
    }
}
