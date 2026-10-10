package com.pda.squad.application.service;

import com.pda.squad.domain.entity.Squad;
import com.pda.user.ProjectRole;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A team plus what a card needs, resolved inside the service transaction (open-in-view is off) with a fixed
 * number of queries per page: member count, who last changed it, a few newest members and the latest joiner.
 */
public record TeamView(Squad team, long memberCount, UserRef updatedBy, List<MemberPreview> memberPreview,
                       LastJoined lastJoined) {

    public record UserRef(UUID userId, String nickname, Long profilePhotoVersion) {}
    /** {@code roles} are the member's project roles in enum order (the first one is the primary role). */
    public record MemberPreview(UUID userId, String nickname, Long profilePhotoVersion, String firstName, String lastName,
                                List<ProjectRole> roles) {}

    public record LastJoined(UUID userId, String nickname, Instant joinedAt) {}
}
