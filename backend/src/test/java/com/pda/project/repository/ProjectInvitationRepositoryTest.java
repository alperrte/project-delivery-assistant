package com.pda.project.repository;

import com.pda.BackendApplication;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.user.ProjectRole;
import com.pda.project.infrastructure.repository.ProjectInvitationRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers
class ProjectInvitationRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private ProjectRepository projects;
    @Autowired private ProjectInvitationRepository invitations;
    @Autowired private EntityManager entityManager;

    @Test
    void tokenHashIsUniqueAcrossInvitations() {
        UUID projectId = newProject();
        invitations.saveAndFlush(ProjectInvitation.forRegisteredUser(projectId, UUID.randomUUID(),
                UUID.randomUUID(), Set.of(ProjectRole.TESTER), "shared-token", future()));

        assertThrows(DataIntegrityViolationException.class, () -> invitations.saveAndFlush(
                ProjectInvitation.forEmail(projectId, "other@example.test", "Other", "Person", UUID.randomUUID(),
                        Set.of(ProjectRole.TESTER), null, "shared-token", future())));
    }

    @Test
    void onlyOnePendingInvitationPerProjectAndUserIsAllowed() {
        // A caught constraint violation aborts the Postgres transaction for any further statement, so this
        // assertThrows must be the last database operation in the test (matches ProjectRepositoryTest's pattern).
        UUID projectId = newProject();
        UUID targetUserId = UUID.randomUUID();
        invitations.saveAndFlush(ProjectInvitation.forRegisteredUser(projectId, targetUserId, UUID.randomUUID(),
                Set.of(ProjectRole.TESTER), "token-one", future()));

        assertThrows(DataIntegrityViolationException.class, () -> invitations.saveAndFlush(
                ProjectInvitation.forRegisteredUser(projectId, targetUserId, UUID.randomUUID(),
                        Set.of(ProjectRole.ANALYST), "token-two", future())));
    }

    @Test
    void onlyOnePendingInvitationPerProjectAndEmailIsAllowed() {
        UUID projectId = newProject();
        invitations.saveAndFlush(ProjectInvitation.forEmail(projectId, "same@example.test", "Same", "Person", UUID.randomUUID(),
                Set.of(ProjectRole.TESTER), null, "token-three", future()));

        assertThrows(DataIntegrityViolationException.class, () -> invitations.saveAndFlush(
                ProjectInvitation.forEmail(projectId, "SAME@example.test", "Same", "Person", UUID.randomUUID(),
                        Set.of(ProjectRole.ANALYST), null, "token-four", future())));
    }

    @Test
    void resendingAfterCancellationIsAllowedBecauseTheUniqueIndexOnlyCoversPending() {
        UUID projectId = newProject();
        UUID targetUserId = UUID.randomUUID();
        ProjectInvitation first = invitations.saveAndFlush(ProjectInvitation.forRegisteredUser(projectId,
                targetUserId, UUID.randomUUID(), Set.of(ProjectRole.TESTER), "token-a", future()));
        first.cancel(Instant.now());
        invitations.saveAndFlush(first);

        invitations.saveAndFlush(ProjectInvitation.forRegisteredUser(projectId, targetUserId, UUID.randomUUID(),
                Set.of(ProjectRole.TESTER), "token-b", future()));

        assertEquals(1, invitations.findByProjectIdAndStatus(projectId, InvitationStatus.PENDING,
                org.springframework.data.domain.PageRequest.of(0, 10)).getTotalElements());
    }

    @Test
    void invitationRoundTripsRolesAndTimestampsThroughPostgres() {
        UUID projectId = newProject();
        UUID invitedBy = UUID.randomUUID();
        UUID id = invitations.saveAndFlush(ProjectInvitation.forEmail(projectId, "invitee@example.test", "Invitee", "Person", invitedBy,
                Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER), "Join us", "round-trip-token", future())).getId();
        entityManager.clear();

        ProjectInvitation stored = invitations.findById(id).orElseThrow();
        assertEquals("invitee@example.test", stored.getEmail());
        assertEquals("Invitee", stored.getInviteeFirstName());
        assertEquals("Join us", stored.getMessage());
        assertEquals(invitedBy, stored.getInvitedBy());
        assertEquals(Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER), stored.getInitialRoles());
        assertTrue(stored.matchesToken("round-trip-token"));
        assertTrue(stored.getCreatedAt() != null && stored.getExpiresAt() != null);
        assertEquals(InvitationStatus.PENDING, stored.getStatus());
    }

    @Test
    void invitationMustTargetEitherAUserOrAnEmailAtTheDatabaseLevel() {
        UUID projectId = newProject();
        assertThrows(Exception.class, () -> entityManager.createNativeQuery(
                "INSERT INTO project_invitations (id, project_id, invited_user_id, email, invited_by, token_hash, "
                        + "status, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?)")
                .setParameter(1, UUID.randomUUID()).setParameter(2, projectId).setParameter(3, null)
                .setParameter(4, null).setParameter(5, UUID.randomUUID())
                .setParameter(6, ProjectInvitation.hashToken("orphan-token")).setParameter(7, "PENDING")
                .setParameter(8, java.sql.Timestamp.from(Instant.now()))
                .setParameter(9, java.sql.Timestamp.from(future()))
                .executeUpdate());
    }

    private UUID newProject() {
        return projects.saveAndFlush(Project.create("Invite target " + UUID.randomUUID(),
                "invite-target-" + UUID.randomUUID(), null, UUID.randomUUID())).getId();
    }

    private static Instant future() {
        return Instant.now().plus(7, ChronoUnit.DAYS);
    }
}
