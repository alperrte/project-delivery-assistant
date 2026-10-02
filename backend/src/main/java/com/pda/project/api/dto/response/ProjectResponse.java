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
 * {@code logoVersion} and {@code bannerVersion} are the epoch-millisecond versions of the stored logo and banner
 * (null = none) and are meant to be
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
        Long bannerVersion,
        Boolean canEdit,
        UserRef updatedBy,
        Team team
) {
    public record UserRef(UUID userId, String nickname, Long profilePhotoVersion) {
    }

    public record Team(int memberCount, List<UserRef> preview) {
    }

    public static ProjectResponse from(Project project) {
        return build(project, null, null, null);
    }

    public static ProjectResponse from(ProjectCardView card) {
        return build(card.project(),
                card.updatedBy() == null ? null : new UserRef(card.updatedBy().userId(), card.updatedBy().nickname(),
                        card.updatedBy().profilePhotoVersion()),
                new Team(card.memberCount(), card.preview().stream()
                        .map(member -> new UserRef(member.userId(), member.nickname(), member.profilePhotoVersion())).toList()),
                card.canEdit());
    }

    private static ProjectResponse build(Project project, UserRef updatedBy, Team team, Boolean canEdit) {
        Instant logoUpdatedAt = project.getLogoUpdatedAt();
        Instant bannerUpdatedAt = project.getBannerUpdatedAt();
        return new ProjectResponse(project.getId(), project.getName(), project.getSlug(),
                project.getDescription(), project.getStatus(), project.getPriority(),
                project.getStartDate(), project.getTargetEndDate(), project.getProjectGoal(),
                project.getTechStack(), project.getVisibility(), project.getOrganizationId(),
                project.getCreatedBy(), project.getCreatedAt(), project.getUpdatedAt(),
                project.getArchivedAt(), project.getProjectType(), project.getTagline(),
                logoUpdatedAt == null ? null : logoUpdatedAt.toEpochMilli(),
                bannerUpdatedAt == null ? null : bannerUpdatedAt.toEpochMilli(), canEdit, updatedBy, team);
    }
}
