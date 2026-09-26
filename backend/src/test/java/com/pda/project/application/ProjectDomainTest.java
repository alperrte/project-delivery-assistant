package com.pda.project.application;

import com.pda.project.domain.entity.Project;
import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectVisibility;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ProjectDomainTest {

    private final UUID creatorId = UUID.randomUUID();

    @Test
    void newProjectStartsPrivateAndInPlanning() {
        Project project = Project.create("  PDA  ", "PDA-App", "  Delivery tool  ", creatorId);

        assertEquals("PDA", project.getName());
        assertEquals("pda-app", project.getSlug());
        assertEquals("Delivery tool", project.getDescription());
        assertEquals(ProjectStatus.PLANNING, project.getStatus());
        assertEquals(ProjectPriority.MEDIUM, project.getPriority());
        assertEquals(ProjectVisibility.PRIVATE, project.getVisibility());
        assertEquals(creatorId, project.getCreatedBy());
        assertNull(project.getOrganizationId());
    }

    @Test
    void invalidIdentityAndDatesAreRejectedWithoutPartialUpdate() {
        assertThrows(IllegalArgumentException.class, () -> Project.create(" ", "valid", null, creatorId));
        assertThrows(IllegalArgumentException.class, () -> Project.create("Valid", "bad--slug", null, creatorId));
        assertThrows(NullPointerException.class, () -> Project.create("Valid", "valid", null, null));

        Project project = Project.create("Original", "original", null, creatorId);
        assertThrows(IllegalArgumentException.class, () -> project.updateDetails("Changed", null,
                ProjectPriority.HIGH, LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 1),
                null, null, null));
        assertEquals("Original", project.getName());
    }

    @Test
    void archiveMarksProjectAndPreventsFurtherChanges() {
        Project project = Project.create("PDA", "pda", null, creatorId);

        project.archive();

        assertEquals(ProjectStatus.ARCHIVED, project.getStatus());
        assertNotNull(project.getArchivedAt());
        assertThrows(IllegalStateException.class, () -> project.updateDetails("New", null,
                ProjectPriority.MEDIUM, null, null, null, null, null));
    }
}
