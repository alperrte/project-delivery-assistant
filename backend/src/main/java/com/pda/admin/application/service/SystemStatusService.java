package com.pda.admin.application.service;

import com.pda.shared.HttpErrorCounters;
import com.pda.shared.ScheduledJobRegistry;
import com.pda.user.UserSessions;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Reports reachability, feature flags and operational counters only. Configuration values themselves are never returned:
 * every flag is a boolean ("is it set"), the counters are numbers, the job list holds names, times and an outcome.
 *
 * <p>The scheduled-job list and the 4xx/5xx counters live in memory of this process (see {@link ScheduledJobRegistry} and
 * {@link HttpErrorCounters}): a restart empties them, and with several instances each reports its own.
 */
@Service
public class SystemStatusService {

    private final JdbcTemplate jdbc;
    private final UserSessions sessions;
    private final ScheduledJobRegistry jobs;
    private final HttpErrorCounters httpErrors;
    private final Clock clock;
    private final boolean googleConfigured;
    private final boolean githubConfigured;
    private final boolean mailEnabled;
    private final boolean apiDocsEnabled;
    private final boolean totpKeyConfigured;

    public SystemStatusService(JdbcTemplate jdbc, UserSessions sessions, ScheduledJobRegistry jobs,
                               HttpErrorCounters httpErrors, Clock clock,
                               @Value("${GOOGLE_CLIENT_ID:}") String googleId,
                               @Value("${GOOGLE_CLIENT_SECRET:}") String googleSecret,
                               @Value("${GITHUB_CLIENT_ID:}") String githubId,
                               @Value("${GITHUB_CLIENT_SECRET:}") String githubSecret,
                               @Value("${MAIL_ENABLED:false}") boolean mailEnabled,
                               @Value("${API_DOCS_ENABLED:false}") boolean apiDocsEnabled,
                               @Value("${TOTP_ENCRYPTION_KEY:}") String totpEncryptionKey) {
        this.jdbc = jdbc;
        this.sessions = sessions;
        this.jobs = jobs;
        this.httpErrors = httpErrors;
        this.clock = clock;
        this.googleConfigured = !googleId.isBlank() && !googleSecret.isBlank();
        this.githubConfigured = !githubId.isBlank() && !githubSecret.isBlank();
        this.mailEnabled = mailEnabled;
        this.apiDocsEnabled = apiDocsEnabled;
        // The key is validated at start-up (Base64, 32 bytes), so a non-blank value means two-factor works.
        this.totpKeyConfigured = !totpEncryptionKey.isBlank();
    }

    public Status status() {
        boolean database;
        try {
            database = Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class));
        } catch (RuntimeException exception) {
            database = false;
        }
        long activeSessions = 0;
        if (database) {
            try {
                activeSessions = sessions.countAllActive(clock.instant());
            } catch (RuntimeException exception) {
                activeSessions = 0;
            }
        }
        HttpErrorCounters.Counts counts = httpErrors.last24Hours();
        List<ScheduledJob> scheduled = jobs.snapshot().stream()
                .map(run -> new ScheduledJob(run.name(), run.lastRunAt(),
                        run.outcome() == null ? null : run.outcome().name(), run.affected()))
                .toList();
        return new Status(database ? "UP" : "DOWN", database, googleConfigured, githubConfigured, mailEnabled,
                apiDocsEnabled, totpKeyConfigured, activeSessions,
                new HttpErrorStatus(counts.clientErrors(), counts.serverErrors()), scheduled);
    }

    /**
     * @param totpEncryptionKeyConfigured whether {@code TOTP_ENCRYPTION_KEY} is set (the administrator sign-in needs it); never the key
     * @param activeSessions              sessions of every account that are neither revoked nor expired
     * @param httpErrorsLast24h           answers with a 4xx / 5xx status over the last 24 hours (hourly buckets, this process)
     * @param scheduledJobs               every background job this process knows, with its last run
     */
    public record Status(String status, boolean database, boolean googleLoginConfigured,
                         boolean githubLoginConfigured, boolean mailEnabled, boolean apiDocsEnabled,
                         boolean totpEncryptionKeyConfigured, long activeSessions,
                         HttpErrorStatus httpErrorsLast24h, List<ScheduledJob> scheduledJobs) {}

    public record HttpErrorStatus(long clientErrors, long serverErrors) {}

    /** {@code lastRunAt} and {@code lastOutcome} (SUCCESS or FAILURE) are null until the job has run in this process. */
    public record ScheduledJob(String name, Instant lastRunAt, String lastOutcome, long lastAffected) {}
}
