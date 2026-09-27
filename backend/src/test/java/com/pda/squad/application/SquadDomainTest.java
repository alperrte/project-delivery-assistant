package com.pda.squad.application;

import com.pda.squad.domain.entity.Squad;
import com.pda.squad.domain.entity.SquadMembership;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SquadDomainTest {

    private final UUID projectId = UUID.randomUUID();
    private final UUID creatorId = UUID.randomUUID();

    @Test
    void createTrimsFieldsAndStartsActive() {
        Squad squad = Squad.create(projectId, "  Backend Squad  ", "  Owns the API  ", creatorId);

        assertEquals("Backend Squad", squad.getName());
        assertEquals("Owns the API", squad.getDescription());
        assertEquals(projectId, squad.getProjectId());
        assertEquals(creatorId, squad.getCreatedBy());
        assertTrue(squad.isActive());
        assertNull(squad.getArchivedAt());
    }

    @Test
    void nameIsRequiredAndLengthLimited() {
        assertThrows(IllegalArgumentException.class, () -> Squad.create(projectId, " ", null, creatorId));
        assertThrows(IllegalArgumentException.class,
                () -> Squad.create(projectId, "x".repeat(121), null, creatorId));
        assertThrows(NullPointerException.class, () -> Squad.create(null, "Valid", null, creatorId));
    }

    @Test
    void archiveBlocksFurtherUpdatesAndIsIdempotent() {
        Squad squad = Squad.create(projectId, "Frontend Squad", null, creatorId);

        squad.archive();

        assertNotNull(squad.getArchivedAt());
        assertTrue(!squad.isActive());
        squad.archive();
        assertThrows(IllegalStateException.class, () -> squad.updateDetails("New name", null));
    }

    @Test
    void updateDetailsReplacesNameAndDescription() {
        Squad squad = Squad.create(projectId, "Original", "Original description", creatorId);

        squad.updateDetails("Renamed", null);

        assertEquals("Renamed", squad.getName());
        assertNull(squad.getDescription());
    }

    @Test
    void membershipRequiresSquadUserAndAdder() {
        UUID squadId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        SquadMembership membership = SquadMembership.add(squadId, userId, creatorId);

        assertEquals(squadId, membership.getSquadId());
        assertEquals(userId, membership.getUserId());
        assertEquals(creatorId, membership.getAddedBy());
        assertThrows(NullPointerException.class, () -> SquadMembership.add(null, userId, creatorId));
        assertThrows(NullPointerException.class, () -> SquadMembership.add(squadId, null, creatorId));
        assertThrows(NullPointerException.class, () -> SquadMembership.add(squadId, userId, null));
    }
}
