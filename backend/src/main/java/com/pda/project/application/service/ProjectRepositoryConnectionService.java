package com.pda.project.application.service;

import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryUrlParser.ParsedRepository;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.RolePolicy;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;

/**
 * Public GitHub repository connection use-cases (HMZ-PROJ-29/30). Read-only integration: never clones, never
 * pushes, never opens issues/PRs. A GitHub failure never fails the rest of the project (callers surface
 * {@link GitHubIntegrationException} as its own state, not a project-wide error).
 */
@Service
public class ProjectRepositoryConnectionService {

    private static final int DEFAULT_COMMIT_LIMIT = 10;
    private static final int MAX_COMMIT_LIMIT = 10;

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectRepositoryConnectionRepository connections;
    private final GitHubRepositoryClient gitHub;

    public ProjectRepositoryConnectionService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                              ProjectRepositoryConnectionRepository connections,
                                              GitHubRepositoryClient gitHub) {
        this.projects = projects;
        this.memberships = memberships;
        this.connections = connections;
        this.gitHub = gitHub;
    }

    @Transactional
    public ProjectRepositoryConnection connect(UUID actorId, UUID projectId, String repositoryUrl) {
        requireRepositoryManager(actorId, projectId);
        ParsedRepository parsed = GitHubRepositoryUrlParser.parse(repositoryUrl);
        String defaultBranch = gitHub.fetchMetadata(parsed.owner(), parsed.repository()).defaultBranch();
        return connections.findByProjectId(projectId)
                .map(existing -> {
                    existing.update(parsed.owner(), parsed.repository(), parsed.canonicalUrl(), defaultBranch);
                    return connections.save(existing);
                })
                .orElseGet(() -> connections.saveAndFlush(ProjectRepositoryConnection.connect(projectId,
                        parsed.owner(), parsed.repository(), parsed.canonicalUrl(), defaultBranch, actorId)));
    }

    @Transactional(readOnly = true)
    public ProjectRepositoryConnection detail(UUID actorId, UUID projectId) {
        requireMember(actorId, projectId);
        return connections.findByProjectId(projectId)
                .orElseThrow(() -> new NoSuchElementException("No repository connected"));
    }

    @Transactional
    public void disconnect(UUID actorId, UUID projectId) {
        requireRepositoryManager(actorId, projectId);
        connections.findByProjectId(projectId)
                .orElseThrow(() -> new NoSuchElementException("No repository connected"));
        connections.deleteByProjectId(projectId);
    }

    /** Never fails the caller if GitHub itself fails; that distinction is carried by {@link GitHubIntegrationException}. */
    @Transactional(readOnly = true)
    public List<CommitSummary> latestCommits(UUID actorId, UUID projectId, Integer limit) {
        requireMember(actorId, projectId);
        ProjectRepositoryConnection connection = connections.findByProjectId(projectId)
                .orElseThrow(() -> new NoSuchElementException("No repository connected"));
        int capped = limit == null ? DEFAULT_COMMIT_LIMIT : Math.max(1, Math.min(limit, MAX_COMMIT_LIMIT));
        return gitHub.fetchLatestCommits(connection.getRepositoryOwner(), connection.getRepositoryName(),
                connection.getDefaultBranch(), capped);
    }

    private ProjectMembership requireMember(UUID actorId, UUID projectId) {
        Objects.requireNonNull(actorId, "actorId is required");
        Objects.requireNonNull(projectId, "projectId is required");
        projects.findByIdAndArchivedAtIsNull(projectId)
                .orElseThrow(() -> new NoSuchElementException("Project not found"));
        return memberships.findByProjectIdAndUserIdAndStatus(projectId, actorId, MembershipStatus.ACTIVE)
                .orElseThrow(() -> new AccessDeniedException("Project access denied"));
    }

    private void requireRepositoryManager(UUID actorId, UUID projectId) {
        if (!RolePolicy.allows(requireMember(actorId, projectId).getRoles(), ProjectPermission.REPOSITORY_MANAGE)) {
            throw new AccessDeniedException("Repository management denied");
        }
    }
}
