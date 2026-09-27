package com.pda.squad.api.dto.response;

import com.pda.squad.application.service.SquadMemberSummary;

import java.time.Instant;
import java.util.UUID;

public record SquadMemberResponse(UUID userId, String nickname, UUID addedBy, Instant addedAt) {
    public static SquadMemberResponse from(SquadMemberSummary summary) {
        return new SquadMemberResponse(summary.userId(), summary.nickname(), summary.addedBy(), summary.addedAt());
    }
}
