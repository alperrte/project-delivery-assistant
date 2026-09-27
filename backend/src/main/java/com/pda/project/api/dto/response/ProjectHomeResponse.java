package com.pda.project.api.dto.response;

import com.pda.project.application.service.ProjectHomeService.CriteriaProgress;
import com.pda.project.application.service.ProjectHomeService.ManagerSummary;
import com.pda.project.application.service.ProjectHomeService.OrganizationSummary;
import com.pda.project.application.service.ProjectHomeService.ProjectHomeSummary;
import com.pda.project.application.service.ProjectHomeService.RepositorySummary;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.RepositoryProvider;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ProjectHomeResponse(
        UUID id, String name, String slug, ProjectStatus status, ProjectPriority priority,
        LocalDate startDate, LocalDate targetEndDate,
        OrganizationSummaryResponse organization, List<ManagerSummaryResponse> managers,
        long teamMemberCount, CriteriaProgressResponse criteriaProgress,
        RepositorySummaryResponse repository, Instant createdAt, Instant updatedAt) {

    public static ProjectHomeResponse from(ProjectHomeSummary summary) {
        Project project = summary.project();
        return new ProjectHomeResponse(project.getId(), project.getName(), project.getSlug(), project.getStatus(),
                project.getPriority(), project.getStartDate(), project.getTargetEndDate(),
                OrganizationSummaryResponse.from(summary.organization()),
                summary.managers().stream().map(ManagerSummaryResponse::from).toList(),
                summary.teamMemberCount(),
                CriteriaProgressResponse.from(summary.criteriaProgress()),
                RepositorySummaryResponse.from(summary.repository()),
                project.getCreatedAt(), project.getUpdatedAt());
    }

    public record OrganizationSummaryResponse(UUID id, String name, String slug) {
        static OrganizationSummaryResponse from(OrganizationSummary summary) {
            return summary == null ? null
                    : new OrganizationSummaryResponse(summary.id(), summary.name(), summary.slug());
        }
    }

    public record ManagerSummaryResponse(UUID userId, String nickname) {
        static ManagerSummaryResponse from(ManagerSummary summary) {
            return new ManagerSummaryResponse(summary.userId(), summary.nickname());
        }
    }

    public record CriteriaProgressResponse(long completed, long total) {
        static CriteriaProgressResponse from(CriteriaProgress progress) {
            return new CriteriaProgressResponse(progress.completed(), progress.total());
        }
    }

    public record RepositorySummaryResponse(boolean connected, RepositoryProvider provider, String repositoryOwner,
                                            String repositoryName, String defaultBranch, CommitResponse lastCommit,
                                            boolean githubUnavailable) {
        static RepositorySummaryResponse from(RepositorySummary summary) {
            CommitResponse lastCommit = summary.lastCommit() == null ? null
                    : CommitResponse.from(summary.lastCommit());
            return new RepositorySummaryResponse(summary.connected(), summary.provider(), summary.repositoryOwner(),
                    summary.repositoryName(), summary.defaultBranch(), lastCommit, summary.githubUnavailable());
        }
    }
}
