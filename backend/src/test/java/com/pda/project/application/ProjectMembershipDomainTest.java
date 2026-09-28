package com.pda.project.application;

import com.pda.project.domain.entity.ProjectMembership;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.user.ProjectRole;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProjectMembershipDomainTest {

    private final UUID projectId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @Test
    void initialManagerStartsActiveWithOnlyTheManagerRole() {
        ProjectMembership membership = ProjectMembership.initialManager(projectId, userId);

        assertEquals(projectId, membership.getProjectId());
        assertEquals(userId, membership.getUserId());
        assertEquals(MembershipStatus.ACTIVE, membership.getStatus());
        assertEquals(Set.of(ProjectRole.PROJECT_MANAGER), membership.getRoles());
        assertTrue(membership.hasRole(ProjectRole.PROJECT_MANAGER));
        assertNull(membership.getRemovedAt());
    }

    @Test
    void activeRejectsNullEmptyOrNullContainingRoleSets() {
        assertThrows(NullPointerException.class, () -> ProjectMembership.active(projectId, userId, null));
        assertThrows(IllegalArgumentException.class, () -> ProjectMembership.active(projectId, userId, Set.of()));
        Set<ProjectRole> withNull = new HashSet<>();
        withNull.add(null);
        assertThrows(IllegalArgumentException.class, () -> ProjectMembership.active(projectId, userId, withNull));
    }

    @Test
    void hasRoleIsFalseForAnUnassignedRoleOrARemovedMembership() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER));
        assertFalse(membership.hasRole(ProjectRole.ANALYST));

        membership.remove();
        assertFalse(membership.hasRole(ProjectRole.TESTER));
    }

    @Test
    void addRoleWorksWhileActiveAndFailsOnceRemoved() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER));
        membership.addRole(ProjectRole.ANALYST);
        assertEquals(Set.of(ProjectRole.TESTER, ProjectRole.ANALYST), membership.getRoles());

        membership.remove();
        assertThrows(IllegalStateException.class, () -> membership.addRole(ProjectRole.BACKEND_DEVELOPER));
    }

    @Test
    void replaceRolesOverwritesTheSetAndRejectsEmpty() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER));
        membership.replaceRoles(Set.of(ProjectRole.ANALYST, ProjectRole.BACKEND_DEVELOPER));
        assertEquals(Set.of(ProjectRole.ANALYST, ProjectRole.BACKEND_DEVELOPER), membership.getRoles());

        assertThrows(IllegalArgumentException.class, () -> membership.replaceRoles(Set.of()));
    }

    @Test
    void removeRoleRequiresAtLeastOneRoleToRemainAndRejectsUnassignedRoles() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId,
                Set.of(ProjectRole.TESTER, ProjectRole.ANALYST));

        assertThrows(IllegalArgumentException.class, () -> membership.removeRole(ProjectRole.BACKEND_DEVELOPER));

        membership.removeRole(ProjectRole.ANALYST);
        assertEquals(Set.of(ProjectRole.TESTER), membership.getRoles());

        // Only one role left: removing it would leave the membership with no role at all.
        assertThrows(IllegalArgumentException.class, () -> membership.removeRole(ProjectRole.TESTER));
    }

    @Test
    void removeTransitionsToRemovedClearsRolesAndCannotBeRepeated() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER));
        membership.remove();

        assertEquals(MembershipStatus.REMOVED, membership.getStatus());
        assertNotNull(membership.getRemovedAt());
        assertTrue(membership.getRoles().isEmpty());
        assertThrows(IllegalStateException.class, membership::remove);
    }

    @Test
    void reactivateOnlyWorksOnARemovedMembershipAndRestoresActiveState() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER));

        // Cannot reactivate an already-active membership.
        assertThrows(IllegalStateException.class, () -> membership.reactivate(Set.of(ProjectRole.ANALYST)));

        membership.remove();
        membership.reactivate(Set.of(ProjectRole.BACKEND_DEVELOPER));

        assertEquals(MembershipStatus.ACTIVE, membership.getStatus());
        assertEquals(Set.of(ProjectRole.BACKEND_DEVELOPER), membership.getRoles());
        assertNull(membership.getRemovedAt());
    }

    @Test
    void getRolesReturnsAnImmutableSnapshot() {
        ProjectMembership membership = ProjectMembership.active(projectId, userId, Set.of(ProjectRole.TESTER));
        Set<ProjectRole> snapshot = membership.getRoles();

        assertThrows(UnsupportedOperationException.class, () -> snapshot.add(ProjectRole.ANALYST));
    }
}
