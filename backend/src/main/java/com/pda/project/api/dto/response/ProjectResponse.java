package com.pda.project.api.dto.response;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectVisibility;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ProjectResponse(
        UUID id,
        String name,
        String slug,
        String description,
        ProjectStatus status,
        ProjectPriority priority,
        LocalDate startDate,
        LocalDate targetEndDate,
        String projectGoal,
        String techStack,
        ProjectVisibility visibility,
        UUID organizationId,
        UUID createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
) {
    public static ProjectResponse from(Project project) {
        return new ProjectResponse(project.getId(), project.getName(), project.getSlug(),
                project.getDescription(), project.getStatus(), project.getPriority(),
                project.getStartDate(), project.getTargetEndDate(), project.getProjectGoal(),
                project.getTechStack(), project.getVisibility(), project.getOrganizationId(),
                project.getCreatedBy(), project.getCreatedAt(), project.getUpdatedAt(),
                project.getArchivedAt());
    }
}
