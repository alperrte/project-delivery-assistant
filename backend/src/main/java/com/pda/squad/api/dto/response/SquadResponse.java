package com.pda.squad.api.dto.response;

import com.pda.squad.domain.entity.Squad;

import java.time.Instant;
import java.util.UUID;

public record SquadResponse(UUID id, UUID projectId, String name, String description, UUID createdBy,
                            Instant createdAt, Instant updatedAt, Instant archivedAt,
                            UUID parentTeamId) {
    public static SquadResponse from(Squad squad) {
        return new SquadResponse(squad.getId(), squad.getProjectId(), squad.getName(), squad.getDescription(),
                squad.getCreatedBy(), squad.getCreatedAt(), squad.getUpdatedAt(), squad.getArchivedAt(),
                squad.getParentSquadId());
    }
}
