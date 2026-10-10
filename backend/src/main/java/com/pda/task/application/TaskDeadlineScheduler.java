package com.pda.task.application;

import com.pda.shared.ScheduledJobRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic trigger for {@link TaskDeadlineService}; the interval is {@code pda.task.deadline-scan-interval}. */
@Component
@EnableScheduling
public class TaskDeadlineScheduler {
    private static final Logger log = LoggerFactory.getLogger(TaskDeadlineScheduler.class);

    static final String JOB = "task.deadline-scan";

    private final TaskDeadlineService service;
    private final ScheduledJobRegistry jobs;

    public TaskDeadlineScheduler(TaskDeadlineService service, ScheduledJobRegistry jobs) {
        this.service = service;
        this.jobs = jobs;
        jobs.register(JOB);
    }

    @Scheduled(fixedDelayString = "${pda.task.deadline-scan-interval:PT5M}",
            initialDelayString = "${pda.task.deadline-scan-interval:PT5M}")
    void scan() {
        try {
            int published = service.scan();
            jobs.success(JOB, published);
            if (published > 0) log.info("Task deadline scan published {} notification(s)", published);
        } catch (RuntimeException exception) {
            // A failed scan must not kill the schedule; the next run picks the same candidates up again.
            jobs.failure(JOB);
            log.warn("Task deadline scan failed", exception);
        }
    }
}
