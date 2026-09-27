package com.pda.admin.application.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Reports reachability and feature flags only. Configuration values themselves are never returned. */
@Service
public class SystemStatusService {

    private final JdbcTemplate jdbc;
    private final boolean googleConfigured;
    private final boolean githubConfigured;
    private final boolean mailEnabled;
    private final boolean apiDocsEnabled;

    public SystemStatusService(JdbcTemplate jdbc,
                               @Value("${GOOGLE_CLIENT_ID:}") String googleId,
                               @Value("${GOOGLE_CLIENT_SECRET:}") String googleSecret,
                               @Value("${GITHUB_CLIENT_ID:}") String githubId,
                               @Value("${GITHUB_CLIENT_SECRET:}") String githubSecret,
                               @Value("${MAIL_ENABLED:false}") boolean mailEnabled,
                               @Value("${API_DOCS_ENABLED:false}") boolean apiDocsEnabled) {
        this.jdbc = jdbc;
        this.googleConfigured = !googleId.isBlank() && !googleSecret.isBlank();
        this.githubConfigured = !githubId.isBlank() && !githubSecret.isBlank();
        this.mailEnabled = mailEnabled;
        this.apiDocsEnabled = apiDocsEnabled;
    }

    public Status status() {
        boolean database;
        try {
            database = Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class));
        } catch (RuntimeException exception) {
            database = false;
        }
        return new Status(database ? "UP" : "DOWN", database, googleConfigured, githubConfigured, mailEnabled,
                apiDocsEnabled);
    }

    public record Status(String status, boolean database, boolean googleLoginConfigured,
                         boolean githubLoginConfigured, boolean mailEnabled, boolean apiDocsEnabled) {}
}
