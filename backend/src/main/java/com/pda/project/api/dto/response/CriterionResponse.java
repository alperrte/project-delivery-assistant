package com.pda.project.api.dto.response;

import com.pda.project.domain.entity.ProjectCriterion;

import java.time.Instant;
import java.util.UUID;

public record CriterionResponse(UUID id, UUID projectId, String title, String description, boolean completed,
                                int sortOrder, UUID createdBy, Instant createdAt, UUID completedBy,
                                Instant completedAt) {
    public static CriterionResponse from(ProjectCriterion criterion) {
        return new CriterionResponse(criterion.getId(), criterion.getProjectId(), criterion.getTitle(),
                criterion.getDescription(), criterion.isCompleted(), criterion.getSortOrder(),
                criterion.getCreatedBy(), criterion.getCreatedAt(), criterion.getCompletedBy(),
                criterion.getCompletedAt());
    }
}
