package com.pda.project.application.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic trigger for {@link RepositoryCommitScanService}; the interval is {@code pda.github.commit-scan-interval}. */
@Component
public class RepositoryCommitScanScheduler {
    private static final Logger log = LoggerFactory.getLogger(RepositoryCommitScanScheduler.class);

    private final RepositoryCommitScanService service;

    public RepositoryCommitScanScheduler(RepositoryCommitScanService service) { this.service = service; }

    @Scheduled(fixedDelayString = "${pda.github.commit-scan-interval:PT5M}",
            initialDelayString = "${pda.github.commit-scan-interval:PT5M}")
    void scan() {
        try {
            int published = service.scan();
            if (published > 0) log.info("Repository commit scan published {} notification event(s)", published);
        } catch (RuntimeException exception) {
            // A failed round must not kill the schedule; the next run picks the same connections up again.
            log.warn("Repository commit scan failed", exception);
        }
    }
}
