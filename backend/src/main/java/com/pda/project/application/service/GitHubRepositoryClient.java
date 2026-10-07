package com.pda.project.application.service;

import java.time.Instant;
import java.util.List;

/**
 * Public, read-only GitHub REST access (HMZ-PROJ-28). Callers pass an already-validated
 * {@code owner}/{@code repository} (see {@link GitHubRepositoryUrlParser}) — this client only ever calls
 * {@code api.github.com} URLs it builds itself, never a caller-supplied URL. Branch names and author logins are
 * passed as encoded URI variables only; callers validate them first (see {@link RepositoryReadInput}).
 */
public interface GitHubRepositoryClient {

    /** @throws GitHubIntegrationException if the repository is missing, rate-limited, or GitHub is unreachable. */
    RepositoryMetadata fetchMetadata(String owner, String repository);

    /** @throws GitHubIntegrationException if the repository/branch is missing, rate-limited, or unreachable. */
    List<CommitSummary> fetchLatestCommits(String owner, String repository, String branch, int limit);

    /**
     * One page of a branch's commits, newest first; {@code author} (a GitHub login) is optional.
     *
     * @throws GitHubIntegrationException if the repository/branch is missing, rate-limited, or unreachable.
     */
    List<CommitSummary> fetchCommits(String owner, String repository, String branch, String author, int page,
                                     int perPage);

    /** Up to 100 branches; {@link BranchPage#truncated()} says more exist. */
    BranchPage fetchBranches(String owner, String repository);

    /** Commits on {@code head} that are not on {@code base} (what a branch still has to merge). */
    BranchComparison compare(String owner, String repository, String base, String head);

    record RepositoryMetadata(String defaultBranch, boolean isPrivate) {}

    record CommitSummary(String sha, String shortSha, String message, String author, String authorLogin,
                         String authorAvatarUrl, Instant committedAt, String commitUrl) {}

    record BranchSummary(String name, String headSha, boolean isProtected) {}

    record BranchPage(List<BranchSummary> branches, boolean truncated) {}

    record BranchComparison(int aheadBy, int behindBy, List<CommitSummary> aheadCommits, boolean truncated) {}
}
