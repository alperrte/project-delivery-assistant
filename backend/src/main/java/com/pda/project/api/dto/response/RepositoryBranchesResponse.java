package com.pda.project.api.dto.response;

import com.pda.project.application.service.ProjectRepositoryConnectionService.BranchList;

import java.util.List;

public record RepositoryBranchesResponse(List<Branch> branches, boolean truncated) {

    public record Branch(String name, boolean isDefault, boolean isProtected, String headShortSha) {}

    public static RepositoryBranchesResponse from(BranchList list) {
        return new RepositoryBranchesResponse(list.branches().stream()
                .map(branch -> new Branch(branch.name(), branch.isDefault(), branch.isProtected(),
                        branch.headShortSha()))
                .toList(), list.truncated());
    }
}
