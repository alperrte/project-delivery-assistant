package com.pda.project.api.dto.response;

import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;

import java.time.Instant;

public record CommitResponse(String shortSha, String message, String author, String authorAvatarUrl,
                             Instant committedAt, String commitUrl) {
    public static CommitResponse from(CommitSummary summary) {
        return new CommitResponse(summary.shortSha(), summary.message(), summary.author(),
                summary.authorAvatarUrl(), summary.committedAt(), summary.commitUrl());
    }
}
