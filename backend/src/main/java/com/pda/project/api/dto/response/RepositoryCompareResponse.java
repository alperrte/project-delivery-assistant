package com.pda.project.api.dto.response;

import com.pda.project.application.service.ProjectRepositoryConnectionService.CompareResult;

import java.util.List;

/** {@code unmergedCommits} are the branch's commits that are not on {@code base} yet (newest first). */
public record RepositoryCompareResponse(String base, String branch, int aheadBy, int behindBy,
                                        List<CommitResponse> unmergedCommits, boolean truncated) {
    public static RepositoryCompareResponse from(CompareResult result) {
        return new RepositoryCompareResponse(result.base(), result.branch(), result.aheadBy(), result.behindBy(),
                result.unmergedCommits().stream().map(CommitResponse::from).toList(), result.truncated());
    }
}
