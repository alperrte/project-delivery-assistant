package com.pda.project.application;

import com.pda.project.domain.entity.ProjectCriterion;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjectCriterionDomainTest {

    private final UUID projectId = UUID.randomUUID();
    private final UUID creatorId = UUID.randomUUID();

    @Test
    void createStartsIncomplete() {
        ProjectCriterion criterion = ProjectCriterion.create(projectId, "  Auth done  ", "  Local login works  ",
                0, creatorId);

        assertEquals("Auth done", criterion.getTitle());
        assertEquals("Local login works", criterion.getDescription());
        assertEquals(projectId, criterion.getProjectId());
        assertEquals(creatorId, criterion.getCreatedBy());
        assertFalse(criterion.isCompleted());
        assertNull(criterion.getCompletedBy());
        assertNull(criterion.getCompletedAt());
    }

    @Test
    void titleIsRequiredAndLengthLimited() {
        assertThrows(IllegalArgumentException.class, () -> ProjectCriterion.create(projectId, " ", null, 0,
                creatorId));
        assertThrows(IllegalArgumentException.class,
                () -> ProjectCriterion.create(projectId, "x".repeat(201), null, 0, creatorId));
        assertThrows(NullPointerException.class, () -> ProjectCriterion.create(null, "Valid", null, 0, creatorId));
    }

    @Test
    void completeAndUncompleteToggleStateAndRejectDoubleCalls() {
        ProjectCriterion criterion = ProjectCriterion.create(projectId, "V1 release", null, 0, creatorId);
        UUID completer = UUID.randomUUID();

        criterion.complete(completer);
        assertTrue(criterion.isCompleted());
        assertEquals(completer, criterion.getCompletedBy());
        assertNotNull(criterion.getCompletedAt());
        assertThrows(IllegalStateException.class, () -> criterion.complete(completer));

        criterion.uncomplete();
        assertFalse(criterion.isCompleted());
        assertNull(criterion.getCompletedBy());
        assertNull(criterion.getCompletedAt());
        assertThrows(IllegalStateException.class, criterion::uncomplete);
    }

    @Test
    void updateDetailsAndSortOrderReplaceFields() {
        ProjectCriterion criterion = ProjectCriterion.create(projectId, "Original", "Original description", 2,
                creatorId);

        criterion.updateDetails("Renamed", null);
        criterion.updateSortOrder(5);

        assertEquals("Renamed", criterion.getTitle());
        assertNull(criterion.getDescription());
        assertEquals(5, criterion.getSortOrder());
    }
}
