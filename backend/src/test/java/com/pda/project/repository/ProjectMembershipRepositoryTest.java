package com.pda.project.repository;

import com.pda.BackendApplication;
import com.pda.project.domain.entity.Project;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.ProjectRole;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers
class ProjectMembershipRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private ProjectRepository projects;
    @Autowired private ProjectMembershipRepository memberships;
    @Autowired private EntityManager entityManager;

    @Test
    void joinedAtIsStampedOnInsertAndMembershipRoundTripsThroughPostgres() {
        UUID projectId = newProject();
        UUID userId = UUID.randomUUID();
        UUID id = memberships.saveAndFlush(ProjectMembership.active(projectId, userId,
                Set.of(ProjectRole.TESTER, ProjectRole.ANALYST))).getId();
        entityManager.clear();

        ProjectMembership stored = memberships.findById(id).orElseThrow();
        assertEquals(Set.of(ProjectRole.TESTER, ProjectRole.ANALYST), stored.getRoles());
        assertEquals(MembershipStatus.ACTIVE, stored.getStatus());
        assertNotNull(stored.getJoinedAt());
    }

    @Test
    void sameUserCannotHaveTwoMembershipRowsForTheSameProject() {
        UUID projectId = newProject();
        UUID userId = UUID.randomUUID();
        memberships.saveAndFlush(ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER)));

        assertThrows(DataIntegrityViolationException.class, () -> memberships.saveAndFlush(
                ProjectMembership.active(projectId, userId, Set.of(ProjectRole.ANALYST))));
    }

    @Test
    void findAndExistsLookupsRespectProjectUserAndStatus() {
        UUID projectId = newProject();
        UUID userId = UUID.randomUUID();
        ProjectMembership membership = memberships.saveAndFlush(
                ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER)));

        assertTrue(memberships.existsByProjectIdAndUserId(projectId, userId));
        assertTrue(memberships.findByProjectIdAndUserId(projectId, userId).isPresent());
        assertTrue(memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE)
                .isPresent());
        assertTrue(memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.REMOVED)
                .isEmpty());

        membership.remove();
        memberships.saveAndFlush(membership);
        assertTrue(memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.ACTIVE)
                .isEmpty());
        assertTrue(memberships.findByProjectIdAndUserIdAndStatus(projectId, userId, MembershipStatus.REMOVED)
                .isPresent());
    }

    @Test
    void statusScopedListingAndCountingOnlySeeActiveMembers() {
        UUID projectId = newProject();
        UUID stays = UUID.randomUUID();
        UUID leaves = UUID.randomUUID();
        memberships.saveAndFlush(ProjectMembership.active(projectId, stays, Set.of(ProjectRole.TESTER)));
        ProjectMembership removed = memberships.saveAndFlush(
                ProjectMembership.active(projectId, leaves, Set.of(ProjectRole.ANALYST)));
        removed.remove();
        memberships.saveAndFlush(removed);

        assertEquals(1, memberships.findByProjectIdAndStatus(projectId, MembershipStatus.ACTIVE,
                PageRequest.of(0, 10)).getTotalElements());
        assertEquals(1, memberships.countByProjectIdAndStatus(projectId, MembershipStatus.ACTIVE));
        assertEquals(1, memberships.findByProjectIdAndStatus(projectId, MembershipStatus.REMOVED,
                PageRequest.of(0, 10)).getTotalElements());
    }

    @Test
    void countActiveByProjectIdsBatchesAcrossMultipleProjects() {
        UUID projectA = newProject();
        UUID projectB = newProject();
        memberships.saveAndFlush(ProjectMembership.active(projectA, UUID.randomUUID(), Set.of(ProjectRole.TESTER)));
        memberships.saveAndFlush(ProjectMembership.active(projectA, UUID.randomUUID(), Set.of(ProjectRole.ANALYST)));
        memberships.saveAndFlush(ProjectMembership.active(projectB, UUID.randomUUID(), Set.of(ProjectRole.TESTER)));
        UUID projectC = newProject();

        List<Object[]> counts = memberships.countActiveByProjectIds(List.of(projectA, projectB, projectC));
        assertEquals(2, counts.size());
        for (Object[] row : counts) {
            UUID projectId = (UUID) row[0];
            long count = (long) row[1];
            if (projectId.equals(projectA)) {
                assertEquals(2, count);
            } else if (projectId.equals(projectB)) {
                assertEquals(1, count);
            }
        }
    }

    @Test
    void countWithRoleAndFindByRoleOnlyMatchActiveHoldersOfThatRole() {
        UUID projectId = newProject();
        UUID managerOne = UUID.randomUUID();
        UUID managerTwo = UUID.randomUUID();
        UUID tester = UUID.randomUUID();
        memberships.saveAndFlush(ProjectMembership.active(projectId, managerOne, Set.of(ProjectRole.PROJECT_MANAGER)));
        memberships.saveAndFlush(ProjectMembership.active(projectId, managerTwo, Set.of(ProjectRole.PROJECT_MANAGER)));
        memberships.saveAndFlush(ProjectMembership.active(projectId, tester, Set.of(ProjectRole.TESTER)));

        assertEquals(2, memberships.countWithRole(projectId, MembershipStatus.ACTIVE, ProjectRole.PROJECT_MANAGER));
        assertEquals(0, memberships.countWithRole(projectId, MembershipStatus.ACTIVE, ProjectRole.ANALYST));

        List<ProjectMembership> managers = memberships.findByProjectIdAndStatusAndRole(projectId,
                MembershipStatus.ACTIVE, ProjectRole.PROJECT_MANAGER);
        assertEquals(2, managers.size());
        assertTrue(managers.stream().map(ProjectMembership::getUserId)
                .toList().containsAll(List.of(managerOne, managerTwo)));
        assertFalse(managers.stream().anyMatch(m -> m.getUserId().equals(tester)));
    }

    private UUID newProject() {
        return projects.saveAndFlush(Project.create("Membership host " + UUID.randomUUID(),
                "membership-host-" + UUID.randomUUID(), null, UUID.randomUUID())).getId();
    }
}
