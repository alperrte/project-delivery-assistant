package com.pda.squad.application.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Set;
import com.pda.user.ProjectRole;

/** {@code otherTeams} are the member's other active teams, so the UI knows whether this is their last one. */
public record SquadMemberSummary(UUID userId, String nickname, String email, Set<ProjectRole> roles,
                                 UUID addedBy, Instant addedAt, List<TeamRef> otherTeams,
                                 Long profilePhotoVersion) {

    public record TeamRef(UUID id, String name) {}
}
