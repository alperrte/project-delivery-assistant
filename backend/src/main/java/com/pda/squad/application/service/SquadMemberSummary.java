package com.pda.squad.application.service;

import com.pda.squad.domain.entity.SquadMembership;

import java.time.Instant;
import java.util.UUID;

public record SquadMemberSummary(UUID userId, String nickname, UUID addedBy, Instant addedAt) {
    public static SquadMemberSummary from(SquadMembership membership, String nickname) {
        return new SquadMemberSummary(membership.getUserId(), nickname, membership.getAddedBy(), membership.getAddedAt());
    }
}
