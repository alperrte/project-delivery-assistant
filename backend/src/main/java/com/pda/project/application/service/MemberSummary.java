package com.pda.project.application.service;

import com.pda.project.domain.entity.ProjectMembership;
import com.pda.user.ProjectRole;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record MemberSummary(UUID userId, String nickname, Set<ProjectRole> roles, Instant joinedAt) {
    public static MemberSummary from(ProjectMembership membership, String nickname) {
        return new MemberSummary(membership.getUserId(), nickname, membership.getRoles(), membership.getJoinedAt());
    }
}
