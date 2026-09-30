package com.pda.squad.api.dto.response;

import com.pda.squad.application.service.SquadMemberSummary;

import java.time.Instant;
import java.util.UUID;
import java.util.Set;
import com.pda.user.ProjectRole;

public record SquadMemberResponse(UUID userId, String nickname, String email, Set<ProjectRole> roles,
                                  UUID addedBy, Instant addedAt) {
    public static SquadMemberResponse from(SquadMemberSummary summary) {
        return new SquadMemberResponse(summary.userId(), summary.nickname(), summary.email(), summary.roles(),
                summary.addedBy(), summary.addedAt());
    }
}
