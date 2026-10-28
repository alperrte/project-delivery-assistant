package com.pda.squad.repository;

import com.pda.shared.testing.RepositoryTestBase;

import com.pda.project.domain.entity.Project;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.project.domain.entity.ProjectMembership;
import com.pda.user.ProjectRole;
import java.util.Set;
import com.pda.squad.domain.entity.Squad;
import com.pda.squad.domain.entity.SquadMembership;
import com.pda.squad.infrastructure.repository.SquadMembershipRepository;
import com.pda.squad.infrastructure.repository.SquadRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SquadRepositoryTest extends RepositoryTestBase {


    @Autowired private ProjectRepository projects;
    @Autowired private SquadRepository squads;
    @Autowired private ProjectMembershipRepository memberships;
    @Autowired private SquadMembershipRepository squadMembers;
    @Autowired private EntityManager entityManager;

    @Test
    void archivedSquadsAreExcludedFromActiveQueries() {
        UUID projectId = newProject();
        Squad active = squads.saveAndFlush(Squad.create(projectId, "Active Squad", null, UUID.randomUUID()));
        Squad archived = squads.saveAndFlush(Squad.create(projectId, "Old Squad", null, UUID.randomUUID()));
        archived.archive(UUID.randomUUID());
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
        UUID memberId = memberships.saveAndFlush(ProjectMembership.active(projectId, UUID.randomUUID(),
                Set.of(ProjectRole.TESTER))).getId();
        squadMembers.saveAndFlush(SquadMembership.add(squadId, memberId, UUID.randomUUID()));

        assertThrows(DataIntegrityViolationException.class, () -> squadMembers.saveAndFlush(
                SquadMembership.add(squadId, memberId, UUID.randomUUID())));
    }

    @Test
    void membershipDeletedWithSquadAndQueriesWork() {
        UUID projectId = newProject();
        UUID squadId = squads.saveAndFlush(Squad.create(projectId, "Removable Squad", null, UUID.randomUUID()))
                .getId();
        UUID memberId = memberships.saveAndFlush(ProjectMembership.active(projectId, UUID.randomUUID(),
                Set.of(ProjectRole.TESTER))).getId();
        UUID adder = UUID.randomUUID();
        squadMembers.saveAndFlush(SquadMembership.add(squadId, memberId, adder));

        assertTrue(squadMembers.existsBySquadIdAndProjectMembershipId(squadId, memberId));
        assertEquals(1, squadMembers.countBySquadId(squadId));
        assertEquals(1, squadMembers.findBySquadId(squadId, PageRequest.of(0, 10)).getTotalElements());
        assertEquals(adder, squadMembers.findBySquadIdAndProjectMembershipId(squadId, memberId).orElseThrow().getAddedBy());

        squads.deleteById(squadId);
        squads.flush();
        assertEquals(0, squadMembers.countBySquadId(squadId));
    }

    private UUID newProject() {
        return projects.saveAndFlush(Project.create("Squad host " + UUID.randomUUID(),
                "squad-host-" + UUID.randomUUID(), null, UUID.randomUUID())).getId();
    }
}
