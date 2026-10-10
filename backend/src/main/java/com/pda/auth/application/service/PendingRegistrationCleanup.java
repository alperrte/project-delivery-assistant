package com.pda.auth.application.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Cancels registrations whose code ran out unused (15 minutes), so the email and nickname become free again. */
@Component
class PendingRegistrationCleanup {
    private static final Logger log = LoggerFactory.getLogger(PendingRegistrationCleanup.class);

    private final RegistrationWorkflow registrations;

    PendingRegistrationCleanup(RegistrationWorkflow registrations) {
        this.registrations = registrations;
    }

    @Scheduled(fixedDelayString = "${pda.auth.pending-registration-cleanup-interval:PT1M}",
            initialDelayString = "${pda.auth.pending-registration-cleanup-interval:PT1M}")
    void purge() {
        try {
            int removed = registrations.purgeExpiredPending();
            if (removed > 0) log.info("Cancelled {} unverified registration(s)", removed);
        } catch (RuntimeException exception) {
            // The next run picks the same rows up again.
            log.warn("Unverified registration cleanup failed", exception);
        }
    }
}
