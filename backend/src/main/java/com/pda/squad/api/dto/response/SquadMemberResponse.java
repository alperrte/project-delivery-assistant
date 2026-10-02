package com.pda.squad.api.dto.response;

import com.pda.squad.application.service.SquadMemberSummary;
import com.pda.user.ProjectRole;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public record SquadMemberResponse(UUID userId, String nickname, String email, Set<ProjectRole> roles,
                                  UUID addedBy, Instant addedAt, List<TeamRef> otherTeams,
                                  Long profilePhotoVersion) {

    public record TeamRef(UUID id, String name) {}

    public static SquadMemberResponse from(SquadMemberSummary summary) {
        return new SquadMemberResponse(summary.userId(), summary.nickname(), summary.email(), summary.roles(),
                summary.addedBy(), summary.addedAt(),
                summary.otherTeams().stream().map(team -> new TeamRef(team.id(), team.name())).toList(),
                summary.profilePhotoVersion());
    }
}
