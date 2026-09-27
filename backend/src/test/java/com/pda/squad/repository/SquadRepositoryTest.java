package com.pda.squad.repository;

import com.pda.BackendApplication;
import com.pda.project.domain.entity.Project;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.domain.entity.SquadMembership;
import com.pda.squad.infrastructure.repository.SquadMembershipRepository;
import com.pda.squad.infrastructure.repository.SquadRepository;
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

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = BackendApplication.class)
@Testcontainers
class SquadRepositoryTest {

    @Container
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired private ProjectRepository projects;
    @Autowired private SquadRepository squads;
    @Autowired private SquadMembershipRepository squadMembers;
    @Autowired private EntityManager entityManager;

    @Test
    void archivedSquadsAreExcludedFromActiveQueries() {
        UUID projectId = newProject();
        Squad active = squads.saveAndFlush(Squad.create(projectId, "Active Squad", null, UUID.randomUUID()));
        Squad archived = squads.saveAndFlush(Squad.create(projectId, "Old Squad", null, UUID.randomUUID()));
        archived.archive();
        squads.saveAndFlush(archived);

        assertEquals(1, squads.findByProjectIdAndArchivedAtIsNull(projectId, PageRequest.of(0, 10))
                .getTotalElements());
        assertEquals(1, squads.countByProjectIdAndArchivedAtIsNull(projectId));
        assertTrue(squads.findByIdAndArchivedAtIsNull(active.getId()).isPresent());
        assertFalse(squads.findByIdAndArchivedAtIsNull(archived.getId()).isPresent());
    }

    @Test
    void squadRoundTripsThroughPostgres() {
        UUID projectId = newProject();
        UUID creator = UUID.randomUUID();
        UUID id = squads.saveAndFlush(Squad.create(projectId, "QA Squad", "Handles testing", creator)).getId();
        entityManager.clear();

        Squad stored = squads.findById(id).orElseThrow();
        assertEquals("QA Squad", stored.getName());
        assertEquals("Handles testing", stored.getDescription());
        assertEquals(creator, stored.getCreatedBy());
        assertTrue(stored.getCreatedAt() != null && stored.getUpdatedAt() != null);
    }

    @Test
    void memberMustBeUniquePerSquad() {
        UUID projectId = newProject();
        UUID squadId = squads.saveAndFlush(Squad.create(projectId, "Unique Squad", null, UUID.randomUUID())).getId();
        UUID userId = UUID.randomUUID();
        squadMembers.saveAndFlush(SquadMembership.add(squadId, userId, UUID.randomUUID()));

        assertThrows(DataIntegrityViolationException.class, () -> squadMembers.saveAndFlush(
                SquadMembership.add(squadId, userId, UUID.randomUUID())));
    }

    @Test
    void membershipDeletedWithSquadAndQueriesWork() {
        UUID projectId = newProject();
        UUID squadId = squads.saveAndFlush(Squad.create(projectId, "Removable Squad", null, UUID.randomUUID()))
                .getId();
        UUID userId = UUID.randomUUID();
        UUID adder = UUID.randomUUID();
        squadMembers.saveAndFlush(SquadMembership.add(squadId, userId, adder));

        assertTrue(squadMembers.existsBySquadIdAndUserId(squadId, userId));
        assertEquals(1, squadMembers.countBySquadId(squadId));
        assertEquals(1, squadMembers.findBySquadId(squadId, PageRequest.of(0, 10)).getTotalElements());
        assertEquals(adder, squadMembers.findBySquadIdAndUserId(squadId, userId).orElseThrow().getAddedBy());

        squads.deleteById(squadId);
        squads.flush();
        assertEquals(0, squadMembers.countBySquadId(squadId));
    }

    private UUID newProject() {
        return projects.saveAndFlush(Project.create("Squad host " + UUID.randomUUID(),
                "squad-host-" + UUID.randomUUID(), null, UUID.randomUUID())).getId();
    }
}
