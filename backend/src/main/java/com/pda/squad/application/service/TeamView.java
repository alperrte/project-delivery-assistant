package com.pda.squad.application.service;

import com.pda.squad.domain.entity.Squad;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A team plus what a card needs, resolved inside the service transaction (open-in-view is off) with a fixed
 * number of queries per page: member count, who last changed it, a few newest members and the latest joiner.
 */
public record TeamView(Squad team, long memberCount, UserRef updatedBy, List<UserRef> memberPreview,
                       LastJoined lastJoined) {

    public record UserRef(UUID userId, String nickname) {}

    public record LastJoined(UUID userId, String nickname, Instant joinedAt) {}
}
