package com.pda.project.application.service;

import com.pda.shared.ScheduledJobRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic trigger for {@link RepositoryCommitScanService}; the interval is {@code pda.github.commit-scan-interval}. */
@Component
public class RepositoryCommitScanScheduler {
    private static final Logger log = LoggerFactory.getLogger(RepositoryCommitScanScheduler.class);

    static final String JOB = "project.repository-commit-scan";

    private final RepositoryCommitScanService service;
    private final ScheduledJobRegistry jobs;

    public RepositoryCommitScanScheduler(RepositoryCommitScanService service, ScheduledJobRegistry jobs) {
        this.service = service;
        this.jobs = jobs;
        jobs.register(JOB);
    }

    @Scheduled(fixedDelayString = "${pda.github.commit-scan-interval:PT5M}",
            initialDelayString = "${pda.github.commit-scan-interval:PT5M}")
    void scan() {
        try {
            int published = service.scan();
            jobs.success(JOB, published);
            if (published > 0) log.info("Repository commit scan published {} notification event(s)", published);
        } catch (RuntimeException exception) {
            // A failed round must not kill the schedule; the next run picks the same connections up again.
            jobs.failure(JOB);
            log.warn("Repository commit scan failed", exception);
        }
    }
}
