package com.pda.project.api.dto.response;

import com.pda.project.application.service.ProjectCardView;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectType;
import com.pda.project.domain.enums.ProjectVisibility;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * {@code logoVersion} is the epoch-millisecond version of the stored logo (null = no logo) and is meant to be
 * appended to the logo URL as a cache-busting query. {@code updatedBy} and {@code team} are only filled by the list
 * endpoint, which aggregates them for the whole page in a fixed number of queries.
 */
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
        Instant archivedAt,
        ProjectType projectType,
        String tagline,
        Long logoVersion,
        UserRef updatedBy,
        Team team
) {
    public record UserRef(UUID userId, String nickname) {
    }

    public record Team(int memberCount, List<UserRef> preview) {
    }

    public static ProjectResponse from(Project project) {
        return build(project, null, null);
    }

    public static ProjectResponse from(ProjectCardView card) {
        return build(card.project(),
                card.updatedBy() == null ? null : new UserRef(card.updatedBy().userId(), card.updatedBy().nickname()),
                new Team(card.memberCount(), card.preview().stream()
                        .map(member -> new UserRef(member.userId(), member.nickname())).toList()));
    }

    private static ProjectResponse build(Project project, UserRef updatedBy, Team team) {
        Instant logoUpdatedAt = project.getLogoUpdatedAt();
        return new ProjectResponse(project.getId(), project.getName(), project.getSlug(),
                project.getDescription(), project.getStatus(), project.getPriority(),
                project.getStartDate(), project.getTargetEndDate(), project.getProjectGoal(),
                project.getTechStack(), project.getVisibility(), project.getOrganizationId(),
                project.getCreatedBy(), project.getCreatedAt(), project.getUpdatedAt(),
                project.getArchivedAt(), project.getProjectType(), project.getTagline(),
                logoUpdatedAt == null ? null : logoUpdatedAt.toEpochMilli(), updatedBy, team);
    }
}
