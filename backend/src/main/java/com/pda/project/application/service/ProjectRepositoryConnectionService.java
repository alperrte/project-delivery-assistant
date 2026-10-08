package com.pda.project.application.service;

import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryUrlParser.ParsedRepository;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.domain.enums.RepositoryTrackingMode;
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
    private static final int MAX_COMMIT_LIMIT = 50;
    private static final int MAX_COMMIT_PAGE = 10;

    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final ProjectRepositoryConnectionRepository connections;
    private final GitHubRepositoryClient gitHub;
    private final GitHubReadCache cache;
    private final RepositoryReadRateLimiter readLimiter;

    public ProjectRepositoryConnectionService(ProjectRepository projects, ProjectMembershipRepository memberships,
                                              ProjectRepositoryConnectionRepository connections,
                                              GitHubRepositoryClient gitHub, GitHubReadCache cache,
                                              RepositoryReadRateLimiter readLimiter) {
        this.projects = projects;
        this.memberships = memberships;
        this.connections = connections;
        this.gitHub = gitHub;
        this.cache = cache;
        this.readLimiter = readLimiter;
    }

    /** {@code trackingMode} defaults to BASIC and {@code notifyOnCommits} to true when null. */
    @Transactional
    public ProjectRepositoryConnection connect(UUID actorId, UUID projectId, String repositoryUrl,
                                               RepositoryTrackingMode trackingMode, Boolean notifyOnCommits) {
        requireRepositoryManager(actorId, projectId);
        RepositoryTrackingMode mode = trackingMode == null ? RepositoryTrackingMode.BASIC : trackingMode;
        boolean notify = notifyOnCommits == null || notifyOnCommits;
        ParsedRepository parsed = GitHubRepositoryUrlParser.parse(repositoryUrl);
        GitHubRepositoryClient.RepositoryMetadata metadata = gitHub.fetchMetadata(parsed.owner(), parsed.repository());
        if (metadata.isPrivate()) {
            throw new PrivateRepositoryException();
        }
        String defaultBranch = metadata.defaultBranch();
        // History before the connect is never announced: tracking starts from the branch tip as it is now.
        String baseline = currentTip(parsed.owner(), parsed.repository(), defaultBranch);
        return connections.findByProjectId(projectId)
                .map(existing -> {
                    existing.update(parsed.owner(), parsed.repository(), parsed.canonicalUrl(), defaultBranch);
                    existing.changeSettings(mode, notify);
                    existing.trackFrom(baseline);
                    return connections.save(existing);
                })
                .orElseGet(() -> {
                    ProjectRepositoryConnection created = ProjectRepositoryConnection.connect(projectId,
                            parsed.owner(), parsed.repository(), parsed.canonicalUrl(), defaultBranch, actorId);
                    created.changeSettings(mode, notify);
                    created.trackFrom(baseline);
                    return connections.saveAndFlush(created);
                });
    }

    /** Changes the tracking mode and the notification switch of the existing connection. */
    @Transactional
    public ProjectRepositoryConnection updateSettings(UUID actorId, UUID projectId, RepositoryTrackingMode mode,
                                                      boolean notifyOnCommits) {
        requireRepositoryManager(actorId, projectId);
        ProjectRepositoryConnection connection = connections.findByProjectId(projectId)
                .orElseThrow(() -> new NoSuchElementException("No repository connected"));
        connection.changeSettings(mode, notifyOnCommits);
        return connections.save(connection);
    }

    /** A failing GitHub call here only leaves the baseline empty; the first scan then writes it. */
    private String currentTip(String owner, String repository, String branch) {
        try {
            List<CommitSummary> latest = gitHub.fetchLatestCommits(owner, repository, branch, 1);
            return latest.isEmpty() ? null : latest.get(0).sha();
        } catch (GitHubIntegrationException exception) {
            return null;
        }
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

    /**
     * One page of a branch's commits (the default branch when {@code branch} is blank), optionally by one GitHub
     * author. Never fails the caller if GitHub itself fails; that distinction is carried by
     * {@link GitHubIntegrationException}. Not transactional on purpose: no database connection is held while GitHub
     * is called.
     */
    public List<CommitSummary> commits(UUID actorId, UUID projectId, String branch, String author, Integer page,
                                       Integer limit) {
        ProjectRepositoryConnection connection = readableConnection(actorId, projectId);
        if (connection.getTrackingMode() == RepositoryTrackingMode.BASIC
                && (isOtherBranch(connection, branch) || (author != null && !author.isBlank()))) {
            throw new RepositoryAdvancedRequiredException();
        }
        String resolvedBranch = resolveBranch(connection, branch);
        String resolvedAuthor = RepositoryReadInput.author(author);
        int resolvedPage = page == null ? 1 : page;
        if (resolvedPage < 1 || resolvedPage > MAX_COMMIT_PAGE) {
            throw new IllegalArgumentException("Invalid page");
        }
        int perPage = limit == null ? DEFAULT_COMMIT_LIMIT : Math.max(1, Math.min(limit, MAX_COMMIT_LIMIT));
        String owner = connection.getRepositoryOwner();
        String name = connection.getRepositoryName();
        return cache.get("commits:" + owner + "/" + name + ":" + resolvedBranch + ":" + resolvedAuthor + ":"
                + resolvedPage + ":" + perPage,
                () -> gitHub.fetchCommits(owner, name, resolvedBranch, resolvedAuthor, resolvedPage, perPage));
    }

    /** The repository's branches, default branch first, then alphabetically. */
    public BranchList branches(UUID actorId, UUID projectId) {
        ProjectRepositoryConnection connection = readableConnection(actorId, projectId);
        requireAdvanced(connection);
        GitHubRepositoryClient.BranchPage page = branchPage(connection);
        List<BranchView> views = page.branches().stream()
                .map(branch -> new BranchView(branch.name(), branch.name().equals(connection.getDefaultBranch()),
                        branch.isProtected(), branch.headSha().length() > 7 ? branch.headSha().substring(0, 7)
                        : branch.headSha()))
                .sorted((left, right) -> left.isDefault() != right.isDefault() ? (left.isDefault() ? -1 : 1)
                        : left.name().compareToIgnoreCase(right.name()))
                .toList();
        return new BranchList(views, page.truncated());
    }

    /** What {@code branch} still has to merge into the default branch (empty for the default branch itself). */
    public CompareResult compare(UUID actorId, UUID projectId, String branch) {
        ProjectRepositoryConnection connection = readableConnection(actorId, projectId);
        requireAdvanced(connection);
        String base = connection.getDefaultBranch();
        String head = resolveBranch(connection, branch);
        if (head.equals(base)) {
            return new CompareResult(base, head, 0, 0, List.of(), false);
        }
        String owner = connection.getRepositoryOwner();
        String name = connection.getRepositoryName();
        GitHubRepositoryClient.BranchComparison comparison = cache.get(
                "compare:" + owner + "/" + name + ":" + base + "..." + head,
                () -> gitHub.compare(owner, name, base, head));
        return new CompareResult(base, head, comparison.aheadBy(), comparison.behindBy(),
                comparison.aheadCommits(), comparison.truncated());
    }

    private static boolean isOtherBranch(ProjectRepositoryConnection connection, String requested) {
        return requested != null && !requested.isBlank() && !requested.equals(connection.getDefaultBranch());
    }

    private static void requireAdvanced(ProjectRepositoryConnection connection) {
        if (connection.getTrackingMode() != RepositoryTrackingMode.ADVANCED) {
            throw new RepositoryAdvancedRequiredException();
        }
    }

    private GitHubRepositoryClient.BranchPage branchPage(ProjectRepositoryConnection connection) {
        String owner = connection.getRepositoryOwner();
        String name = connection.getRepositoryName();
        return cache.get("branches:" + owner + "/" + name, () -> gitHub.fetchBranches(owner, name));
    }

    /**
     * Blank means the default branch. Anything else must be a syntactically valid ref <em>and</em> an existing branch
     * from the cached list, so made-up names can never be used to spend GitHub requests.
     */
    private String resolveBranch(ProjectRepositoryConnection connection, String requested) {
        if (requested == null || requested.isBlank() || requested.equals(connection.getDefaultBranch())) {
            return connection.getDefaultBranch();
        }
        String branch = RepositoryReadInput.branch(requested);
        boolean known = branchPage(connection).branches().stream().anyMatch(candidate -> candidate.name().equals(branch));
        if (!known) {
            throw new NoSuchElementException("Branch not found");
        }
        return branch;
    }

    private ProjectRepositoryConnection readableConnection(UUID actorId, UUID projectId) {
        requireMember(actorId, projectId);
        if (!readLimiter.tryAcquire(actorId)) {
            throw new RepositoryReadLimitException();
        }
        return connections.findByProjectId(projectId)
                .orElseThrow(() -> new NoSuchElementException("No repository connected"));
    }

    public record BranchView(String name, boolean isDefault, boolean isProtected, String headShortSha) {}

    public record BranchList(List<BranchView> branches, boolean truncated) {}

    public record CompareResult(String base, String branch, int aheadBy, int behindBy,
                                List<CommitSummary> unmergedCommits, boolean truncated) {}

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
