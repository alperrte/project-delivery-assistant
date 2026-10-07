package com.pda.project.application.service;

import com.pda.project.ProjectRepositoryEvents;
import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectRepositoryConnection;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * One round of default-branch commit tracking. Each connected repository is read from GitHub <em>outside</em> any
 * database transaction; only a detected tip change opens a short transaction that claims the change with a
 * conditional UPDATE. Just the caller that moves the marker publishes the event, so several instances or a repeated
 * scan never notify twice. The round is bounded ({@code pda.github.commit-scan-batch}) and stops on the first
 * GitHub rate-limit answer, so tracking cannot starve the repository page of the shared GitHub quota.
 */
@Service
public class RepositoryCommitScanService {

    private static final Logger log = LoggerFactory.getLogger(RepositoryCommitScanService.class);
    static final int WINDOW = 20;
    private static final int STOP_ROUND = -1;
    private static final int BATCH_WITHOUT_TOKEN = 5;
    private static final int BATCH_WITH_TOKEN = 50;

    private final ProjectRepositoryConnectionRepository connections;
    private final ProjectRepository projects;
    private final ProjectMembershipRepository memberships;
    private final GitHubRepositoryClient gitHub;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final int batchSize;

    public RepositoryCommitScanService(ProjectRepositoryConnectionRepository connections, ProjectRepository projects,
                                       ProjectMembershipRepository memberships, GitHubRepositoryClient gitHub,
                                       ApplicationEventPublisher events, TransactionTemplate transaction, Clock clock,
                                       @Value("${pda.github.commit-scan-batch:0}") int configuredBatch,
                                       @Value("${pda.github.api-token:}") String apiToken) {
        this.connections = connections;
        this.projects = projects;
        this.memberships = memberships;
        this.gitHub = gitHub;
        this.events = events;
        this.transaction = transaction;
        this.clock = clock;
        boolean hasToken = apiToken != null && !apiToken.isBlank();
        this.batchSize = configuredBatch > 0 ? configuredBatch : hasToken ? BATCH_WITH_TOKEN : BATCH_WITHOUT_TOKEN;
    }

    /** Returns how many {@code CommitsPushed} events were published. */
    public int scan() {
        List<ProjectRepositoryConnection> candidates = transaction.execute(status ->
                connections.findScanCandidates(PageRequest.of(0, batchSize)));
        if (candidates == null) {
            return 0;
        }
        int published = 0;
        for (ProjectRepositoryConnection connection : candidates) {
            try {
                int result = scanOne(connection);
                if (result == STOP_ROUND) {
                    break;
                }
                published += result;
            } catch (RuntimeException exception) {
                // One broken repository must not stop the others; it is retried on a later round.
                log.warn("Repository commit scan failed for connection {}", connection.getId(), exception);
                try {
                    markScanned(connection.getId());
                } catch (RuntimeException ignored) {
                    // Rotation only; the connection simply comes up again next round.
                }
            }
        }
        return published;
    }

    /** @return {@link #STOP_ROUND} when GitHub's rate limit is reached, else the number of events published (0 or 1). */
    private int scanOne(ProjectRepositoryConnection connection) {
        UUID id = connection.getId();
        List<CommitSummary> commits;
        try {
            commits = gitHub.fetchLatestCommits(connection.getRepositoryOwner(), connection.getRepositoryName(),
                    connection.getDefaultBranch(), WINDOW);
        } catch (GitHubIntegrationException exception) {
            switch (exception.getReason()) {
                case RATE_LIMITED -> {
                    return STOP_ROUND;
                }
                case NOT_FOUND -> refreshDefaultBranch(connection);
                default -> markScanned(id);
            }
            return 0;
        }
        if (commits.isEmpty()) {
            markScanned(id);
            return 0;
        }
        String tip = commits.get(0).sha();
        String previous = connection.getNotifiedHeadSha();
        Instant now = clock.instant();
        if (previous == null) {
            transaction.executeWithoutResult(status -> connections.claimBaseline(id, tip, now));
            return 0;
        }
        if (previous.equals(tip)) {
            markScanned(id);
            return 0;
        }
        int index = indexOf(commits, previous);
        boolean truncated = index < 0;
        int count = truncated ? commits.size() : index;
        Boolean claimed = transaction.execute(status -> {
            if (connections.claimHead(id, previous, tip, now) != 1) {
                return false;
            }
            publish(connection, commits.get(0), count, truncated, now);
            return true;
        });
        return Boolean.TRUE.equals(claimed) ? 1 : 0;
    }

    private void publish(ProjectRepositoryConnection connection, CommitSummary head, int count, boolean truncated,
                         Instant now) {
        Project project = projects.findById(connection.getProjectId()).orElse(null);
        if (project == null) {
            return;
        }
        Set<UUID> recipients = new HashSet<>(memberships.findActiveUserIdsByProject(project.getId()));
        if (recipients.isEmpty()) {
            return;
        }
        events.publishEvent(new ProjectRepositoryEvents.CommitsPushed(project.getId(), project.getName(),
                connection.getRepositoryOwner() + "/" + connection.getRepositoryName(), connection.getDefaultBranch(),
                Math.max(1, count), truncated, head.message(),
                head.author() != null ? head.author() : head.authorLogin(), recipients, now));
    }

    /** The default branch may have been renamed on GitHub: pick up the new name and restart from a fresh baseline. */
    private void refreshDefaultBranch(ProjectRepositoryConnection connection) {
        try {
            String branch = gitHub.fetchMetadata(connection.getRepositoryOwner(), connection.getRepositoryName())
                    .defaultBranch();
            transaction.executeWithoutResult(status -> connections.findById(connection.getId())
                    .ifPresent(current -> {
                        current.changeDefaultBranch(branch);
                        connections.save(current);
                    }));
        } catch (GitHubIntegrationException exception) {
            markScanned(connection.getId());
        }
    }

    private void markScanned(UUID id) {
        Instant now = clock.instant();
        transaction.executeWithoutResult(status -> connections.markScanned(id, now));
    }

    private static int indexOf(List<CommitSummary> commits, String sha) {
        for (int index = 0; index < commits.size(); index++) {
            if (sha.equals(commits.get(index).sha())) {
                return index;
            }
        }
        return -1;
    }
}
