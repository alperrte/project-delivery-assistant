package com.pda.notification;

import com.pda.BackendApplication;
import com.pda.notification.application.NotificationService;
import com.pda.notification.domain.Notification;
import com.pda.notification.domain.NotificationType;
import com.pda.notification.domain.RepositoryCommits;
import com.pda.notification.domain.ResourceType;
import com.pda.project.application.service.GitHubIntegrationException;
import com.pda.project.application.service.GitHubIntegrationException.Reason;
import com.pda.project.application.service.GitHubRepositoryClient;
import com.pda.project.application.service.GitHubRepositoryClient.CommitSummary;
import com.pda.project.application.service.GitHubRepositoryClient.RepositoryMetadata;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.application.service.ProjectRepositoryConnectionService;
import com.pda.project.application.service.ProjectService;
import com.pda.project.application.service.RepositoryCommitScanService;
import com.pda.project.domain.enums.RepositoryTrackingMode;
import com.pda.project.infrastructure.repository.ProjectRepositoryConnectionRepository;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Default-branch commit tracking end to end: scan -> conditional claim -> event -> one batched notification per
 * active member. GitHub itself is mocked; PostgreSQL (Flyway V59 included) is real.
 */
@SpringBootTest(classes = BackendApplication.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class RepositoryCommitScanIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        // Every connection of the shared database fits in one round.
        registry.add("pda.github.commit-scan-batch", () -> "200");
        registry.add("pda.github.cache-ttl", () -> "PT0S");
    }

    @Autowired UserAccounts users;
    @Autowired ProjectService projects;
    @Autowired ProjectMembershipService memberships;
    @Autowired ProjectRepositoryConnectionService repository;
    @Autowired ProjectRepositoryConnectionRepository connections;
    @Autowired RepositoryCommitScanService scanner;
    @Autowired NotificationService notifications;
    @MockitoBean GitHubRepositoryClient gitHub;

    @Test
    void unchangedTipNotifiesNobody() {
        UUID manager = user();
        Setup setup = connected(manager, "sha-0");
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20)).thenReturn(commits("sha-0"));

        scanner.scan();

        assertEquals(0, pushed(manager).size());
        assertEquals("sha-0", connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());
    }

    @Test
    void newCommitsAreBatchedIntoOneNotificationPerActiveMemberAndNeverRepeated() {
        UUID manager = user();
        UUID member = user();
        Setup setup = connected(manager, "sha-0");
        memberships.addMember(manager, setup.project(), member, Set.of(ProjectRole.BACKEND_DEVELOPER));
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenReturn(commits("sha-3", "sha-2", "sha-1", "sha-0"));

        scanner.scan();

        for (UUID recipient : List.of(manager, member)) {
            List<Notification> received = pushed(recipient);
            assertEquals(1, received.size(), "one batched notification per member");
            Notification notification = received.get(0);
            assertEquals(ResourceType.PROJECT, notification.getResourceType());
            assertEquals(setup.project(), notification.getResourceId());
            assertEquals(setup.project(), notification.getProjectId());
            assertNull(notification.getActorUserId());
            RepositoryCommits snapshot = notification.getRepositoryCommits();
            assertNotNull(snapshot);
            assertEquals(3, snapshot.commitCount());
            assertFalse(snapshot.truncated());
            assertEquals("main", snapshot.branch());
            assertEquals("scanowner/" + setup.repo(), snapshot.repositoryFullName());
            assertEquals("Message sha-3", snapshot.headMessage());
            assertEquals("Alper", snapshot.headAuthor());
        }
        assertEquals("sha-3", connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());

        // The marker moved with the first scan, so scanning again with the same tip adds nothing.
        scanner.scan();
        assertEquals(1, pushed(manager).size());
        assertEquals(1, pushed(member).size());
    }

    @Test
    void aTipMissingFromTheWindowReportsTheWindowAsTruncated() {
        UUID manager = user();
        Setup setup = connected(manager, "old-tip");
        List<String> shas = new ArrayList<>();
        for (int i = 25; i > 0; i--) shas.add("new-" + i);
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenReturn(commits(shas.subList(0, 20).toArray(String[]::new)));

        scanner.scan();

        RepositoryCommits snapshot = pushed(manager).get(0).getRepositoryCommits();
        assertEquals(20, snapshot.commitCount());
        assertTrue(snapshot.truncated());
    }

    @Test
    void archivedProjectsAreSkipped() {
        UUID manager = user();
        Setup setup = connected(manager, "sha-0");
        projects.archive(manager, setup.project());
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenReturn(commits("sha-1", "sha-0"));

        scanner.scan();

        assertEquals(0, pushed(manager).size());
        assertEquals("sha-0", connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());
    }

    @Test
    void removedMembersAreNotNotified() {
        UUID manager = user();
        UUID removed = user();
        Setup setup = connected(manager, "sha-0");
        memberships.addMember(manager, setup.project(), removed, Set.of(ProjectRole.TESTER));
        memberships.removeMember(manager, setup.project(), removed);
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenReturn(commits("sha-1", "sha-0"));

        scanner.scan();

        assertEquals(1, pushed(manager).size());
        assertEquals(0, pushed(removed).size());
    }

    @Test
    void aMissingBaselineIsWrittenByTheFirstScanWithoutNotifying() {
        UUID manager = user();
        String repo = repoName();
        UUID project = projects.create(manager, "Scan baseline " + UUID.randomUUID(), null, null).getId();
        Mockito.when(gitHub.fetchMetadata("scanowner", repo)).thenReturn(new RepositoryMetadata("main", false));
        Mockito.when(gitHub.fetchLatestCommits("scanowner", repo, "main", 1))
                .thenThrow(new GitHubIntegrationException(Reason.UNAVAILABLE, "GitHub is currently unavailable"));
        repository.connect(manager, project, "https://github.com/scanowner/" + repo, null, null);
        assertNull(connections.findByProjectId(project).orElseThrow().getNotifiedHeadSha());
        Mockito.when(gitHub.fetchLatestCommits("scanowner", repo, "main", 20)).thenReturn(commits("sha-2", "sha-1"));

        scanner.scan();

        assertEquals("sha-2", connections.findByProjectId(project).orElseThrow().getNotifiedHeadSha());
        assertEquals(0, pushed(manager).size());
    }

    @Test
    void gitHubRateLimitStopsTheRoundWithoutThrowingOrNotifying() {
        UUID manager = user();
        Setup setup = connected(manager, "sha-0");
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenThrow(new GitHubIntegrationException(Reason.RATE_LIMITED, "GitHub rate limit reached"));

        assertDoesNotThrow(() -> scanner.scan());

        assertEquals(0, pushed(manager).size());
        assertEquals("sha-0", connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());
    }

    @Test
    void switchedOffNotificationsAreNeverScannedAndTurningThemOnAgainRebaselines() {
        UUID manager = user();
        Setup setup = connected(manager, "sha-0");
        repository.updateSettings(manager, setup.project(), RepositoryTrackingMode.BASIC, false);
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenReturn(commits("sha-2", "sha-1", "sha-0"));

        scanner.scan();

        assertEquals(0, pushed(manager).size(), "switched off: nothing announced");
        assertEquals("sha-0", connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());

        // Back on: the commits that arrived meanwhile are not announced, the first scan only writes a baseline.
        repository.updateSettings(manager, setup.project(), RepositoryTrackingMode.BASIC, true);
        assertNull(connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());
        scanner.scan();
        assertEquals(0, pushed(manager).size());
        assertEquals("sha-2", connections.findByProjectId(setup.project()).orElseThrow().getNotifiedHeadSha());

        // Only a commit after that is announced.
        Mockito.when(gitHub.fetchLatestCommits("scanowner", setup.repo(), "main", 20))
                .thenReturn(commits("sha-3", "sha-2"));
        scanner.scan();
        assertEquals(1, pushed(manager).size());
    }

    private Setup connected(UUID manager, String tip) {
        String repo = repoName();
        UUID project = projects.create(manager, "Scan " + UUID.randomUUID(), null, null).getId();
        Mockito.when(gitHub.fetchMetadata("scanowner", repo)).thenReturn(new RepositoryMetadata("main", false));
        Mockito.when(gitHub.fetchLatestCommits("scanowner", repo, "main", 1)).thenReturn(commits(tip));
        repository.connect(manager, project, "https://github.com/scanowner/" + repo, null, null);
        return new Setup(project, repo);
    }

    private List<Notification> pushed(UUID recipient) {
        return notifications.list(recipient, false, NotificationType.REPOSITORY_COMMITS_PUSHED, 0, 50).getContent();
    }

    private static List<CommitSummary> commits(String... shas) {
        return java.util.Arrays.stream(shas).map(sha -> new CommitSummary(sha, sha, "Message " + sha, "Alper",
                "alperrte", null, Instant.parse("2026-10-07T10:00:00Z"), "https://github.com/a/b/commit/" + sha))
                .toList();
    }

    private static String repoName() {
        return "repo-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private UUID user() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return users.registerLocal("scan" + suffix + "@example.test", "s" + suffix, UUID.randomUUID().toString());
    }

    private record Setup(UUID project, String repo) {
    }
}
