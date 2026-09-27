package com.pda.project.application.service;

import java.time.Instant;
import java.util.List;

/**
 * Public, read-only GitHub REST access (HMZ-PROJ-28). Callers pass an already-validated
 * {@code owner}/{@code repository} (see {@link GitHubRepositoryUrlParser}) — this client only ever calls
 * {@code api.github.com} URLs it builds itself, never a caller-supplied URL.
 */
public interface GitHubRepositoryClient {

    /** @throws GitHubIntegrationException if the repository is missing, rate-limited, or GitHub is unreachable. */
    RepositoryMetadata fetchMetadata(String owner, String repository);

    /** @throws GitHubIntegrationException if the repository/branch is missing, rate-limited, or unreachable. */
    List<CommitSummary> fetchLatestCommits(String owner, String repository, String branch, int limit);

    record RepositoryMetadata(String defaultBranch) {}

    record CommitSummary(String shortSha, String message, String author, String authorAvatarUrl,
                         Instant committedAt, String commitUrl) {}
}
