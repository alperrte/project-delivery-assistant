package com.pda.project.api.dto.response;

import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;

import java.time.Instant;

/** {@code sha} (full) and {@code authorLogin} (null when the commit author has no GitHub account) join the short form. */
public record CommitResponse(String sha, String shortSha, String message, String author, String authorLogin,
                             String authorAvatarUrl, Instant committedAt, String commitUrl) {
    public static CommitResponse from(CommitSummary summary) {
        return new CommitResponse(summary.sha(), summary.shortSha(), summary.message(), summary.author(),
                summary.authorLogin(), summary.authorAvatarUrl(), summary.committedAt(), summary.commitUrl());
    }
}
