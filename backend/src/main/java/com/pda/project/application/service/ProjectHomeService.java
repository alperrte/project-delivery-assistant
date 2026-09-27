package com.pda.project.application.service;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.domain.enums.RepositoryProvider;
import com.pda.project.infrastructure.repository.ProjectCriterionRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
import com.pda.project.organization.application.OrganizationService;
import com.pda.project.organization.domain.Organization;
import com.pda.user.ProjectPermission;
import com.pda.user.ProjectRole;
import com.pda.user.RolePolicy;
import com.pda.user.UserAccounts;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

/**
 * Project Home aggregate (HMZ-PROJ-32/35): composes project-only data that already has a safe source — header,
 * status/priority, organization, managers, team count, success-criteria progress and repository summary. Squad
 * count is deliberately NOT included here: Squad is its own Spring Modulith module and already depends on
 * Project via {@code ProjectAccess}, so Project reaching back into Squad would create a module cycle (see ADR
 * 0001). The squad count is already available to callers from the existing squad list endpoint's pagination
 * total. Work Service task counts and Activity's recent-activity feed are likewise left out: neither module
 * exposes a public contract yet, and this service never fakes data or reaches into another module's repository.
 */
@Service
public class ProjectHomeService {

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectCriterionRepository criteria;
    private final ProjectRepositoryConnectionRepository repositoryConnections;
    private final GitHubRepositoryClient gitHub;
    private final OrganizationService organizations;
    private final UserAccounts users;

    public ProjectHomeService(ProjectRepository projects, ProjectMembershipRepository memberships,
                              ProjectCriterionRepository criteria,
                              ProjectRepositoryConnectionRepository repositoryConnections,
                              GitHubRepositoryClient gitHub, OrganizationService organizations,
                              UserAccounts users) {
        this.projects = projects;
        this.memberships = memberships;
        this.criteria = criteria;
        this.repositoryConnections = repositoryConnections;
        this.gitHub = gitHub;
        this.organizations = organizations;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public ProjectHomeSummary summary(UUID actorId, UUID projectId) {
        require(actorId, projectId, ProjectPermission.PROJECT_VIEW);
        Project project = activeProject(projectId);

        OrganizationSummary organization = project.getOrganizationId() == null ? null
                : organizationSummary(project.getOrganizationId());

        List<ManagerSummary> managers = memberships
                .findByProjectIdAndStatusAndRole(projectId, MembershipStatus.ACTIVE, ProjectRole.PROJECT_MANAGER)
                .stream()
                .map(this::managerSummary)
                .toList();
        long teamMemberCount = memberships.countByProjectIdAndStatus(projectId, MembershipStatus.ACTIVE);

        long totalCriteria = criteria.countByProjectId(projectId);
        long completedCriteria = criteria.countByProjectIdAndCompletedTrue(projectId);
        CriteriaProgress criteriaProgress = new CriteriaProgress(completedCriteria, totalCriteria);

        RepositorySummary repository = repositorySummary(projectId);

        return new ProjectHomeSummary(project, organization, managers, teamMemberCount,
                criteriaProgress, repository);
    }

    /** An organization that was archived/removed after being linked never breaks Project Home. */
    private OrganizationSummary organizationSummary(UUID organizationId) {
        try {
            Organization organization = organizations.requireActive(organizationId);
            return new OrganizationSummary(organization.getId(), organization.getName(), organization.getSlug());
        } catch (NoSuchElementException ex) {
            return null;
        }
    }

    private ManagerSummary managerSummary(ProjectMembership membership) {
        String nickname = users.findActiveById(membership.getUserId())
                .map(UserAccounts.AuthenticatedUser::nickname)
                .orElse(null);
        return new ManagerSummary(membership.getUserId(), nickname);
    }

    /** A missing or failing GitHub call never fails Project Home; it surfaces as its own safe state instead. */
    private RepositorySummary repositorySummary(UUID projectId) {
        return repositoryConnections.findByProjectId(projectId)
                .map(connection -> {
                    GitHubRepositoryClient.CommitSummary lastCommit = null;
                    boolean unavailable = false;
                    try {
                        List<GitHubRepositoryClient.CommitSummary> commits = gitHub.fetchLatestCommits(
                                connection.getRepositoryOwner(), connection.getRepositoryName(),
                                connection.getDefaultBranch(), 1);
                        lastCommit = commits.isEmpty() ? null : commits.get(0);
                    } catch (GitHubIntegrationException ex) {
                        unavailable = true;
                    }
                    return new RepositorySummary(true, connection.getProvider(), connection.getRepositoryOwner(),
                            connection.getRepositoryName(), connection.getDefaultBranch(), lastCommit, unavailable);
                })
                .orElseGet(() -> new RepositorySummary(false, null, null, null, null, null, false));
    }

    private Project activeProject(UUID projectId) {
        return projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
    }

    private ProjectMembership requireMember(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, actorId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
    }

    private void require(UUID actorId, UUID projectId, ProjectPermission permission) {
        if (!RolePolicy.allows(requireMember(actorId, projectId).getRoles(), permission)) {
            throw new AccessDeniedException("Project permission denied");
        }
    }

    public record ProjectHomeSummary(Project project, OrganizationSummary organization,
                                     List<ManagerSummary> managers, long teamMemberCount,
                                     CriteriaProgress criteriaProgress, RepositorySummary repository) {}

    public record OrganizationSummary(UUID id, String name, String slug) {}

    public record ManagerSummary(UUID userId, String nickname) {}

    public record CriteriaProgress(long completed, long total) {}

    public record RepositorySummary(boolean connected, RepositoryProvider provider, String repositoryOwner,
                                    String repositoryName, String defaultBranch,
                                    GitHubRepositoryClient.CommitSummary lastCommit, boolean githubUnavailable) {}
}
