package com.pda.squad.api.dto.response;

import com.pda.squad.domain.entity.SquadMembership;

import java.time.Instant;
import java.util.UUID;

public record SquadMemberResponse(UUID userId, UUID addedBy, Instant addedAt) {
    public static SquadMemberResponse from(SquadMembership membership) {
        return new SquadMemberResponse(membership.getUserId(), membership.getAddedBy(), membership.getAddedAt());
    }
}
