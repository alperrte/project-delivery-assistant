package com.pda.shared;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * In-memory record of when each background job last ran and how it ended, for the administrator system status. It is
 * deliberately not persisted: a restart forgets it (every job then shows "not run yet" until its next run), which is
 * enough to see that a job is alive and keeps the status free of another table. It holds names, times, an outcome and
 * a row count; never any data the job touched.
 */
@Component
public class ScheduledJobRegistry {

    public enum Outcome { SUCCESS, FAILURE }

    /** {@code lastRunAt} and {@code outcome} are null until the job has run once in this process. */
    public record JobRun(String name, Instant lastRunAt, Outcome outcome, long affected) {}

    private final Map<String, JobRun> jobs = new ConcurrentHashMap<>();
    private final Clock clock;

    public ScheduledJobRegistry(Clock clock) {
        this.clock = clock;
    }

    /** Lists the job as "not run yet" so the status shows it from start-up on. */
    public void register(String name) {
        jobs.putIfAbsent(name, new JobRun(name, null, null, 0));
    }

    public void success(String name, long affected) {
        jobs.put(name, new JobRun(name, clock.instant(), Outcome.SUCCESS, affected));
    }

    public void failure(String name) {
        jobs.put(name, new JobRun(name, clock.instant(), Outcome.FAILURE, 0));
    }

    public List<JobRun> snapshot() {
        return jobs.values().stream().sorted(java.util.Comparator.comparing(JobRun::name)).toList();
    }
}
