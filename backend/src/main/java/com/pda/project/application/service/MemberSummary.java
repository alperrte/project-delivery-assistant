package com.pda.project.application.service;

import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.ProjectRole;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record MemberSummary(UUID userId, Set<ProjectRole> roles, Instant joinedAt) {
    public static MemberSummary from(ProjectMembership membership) {
        return new MemberSummary(membership.getUserId(), membership.getRoles(), membership.getJoinedAt());
    }
}
