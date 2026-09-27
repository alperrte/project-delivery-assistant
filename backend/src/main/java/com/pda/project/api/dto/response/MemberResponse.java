package com.pda.project.api.dto.response;

import com.pda.project.application.service.MemberSummary;
import com.pda.user.ProjectRole;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record MemberResponse(UUID userId, String nickname, Set<ProjectRole> roles, Instant joinedAt) {
    public static MemberResponse from(MemberSummary summary) {
        return new MemberResponse(summary.userId(), summary.nickname(), summary.roles(), summary.joinedAt());
    }
}
