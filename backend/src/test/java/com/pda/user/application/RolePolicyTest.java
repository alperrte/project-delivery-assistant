package com.pda.user.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.user.GlobalRole;
import com.pda.user.PlatformPermission;
import com.pda.user.ProjectPermission;
import com.pda.user.ProjectRole;
import com.pda.user.RolePolicy;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class RolePolicyTest {

    private static final List<ProjectRole> CONTRIBUTORS = List.of(ProjectRole.BACKEND_DEVELOPER,
            ProjectRole.FRONTEND_DEVELOPER, ProjectRole.FULL_STACK_DEVELOPER, ProjectRole.AI_ML_DEVELOPER,
            ProjectRole.UI_UX_DEVELOPER, ProjectRole.ANALYST);

    @Test
    void onlyTheProjectManagerMayManageProjectWideReminders() {
        assertTrue(RolePolicy.allows(Set.of(ProjectRole.PROJECT_MANAGER), ProjectPermission.REMINDER_MANAGE));
        for (ProjectRole role : ProjectRole.values()) {
            if (role != ProjectRole.PROJECT_MANAGER) {
                assertFalse(RolePolicy.allows(Set.of(role), ProjectPermission.REMINDER_MANAGE), role.name());
                // Every contributor can still see the project, which is all a personal reminder needs.
                assertTrue(RolePolicy.allows(Set.of(role), ProjectPermission.PROJECT_VIEW), role.name());
            }
        }
    }

    @Test
    void projectManagerHoldsEveryProjectPermission() {
        assertEquals(EnumSet.allOf(ProjectPermission.class),
                RolePolicy.permissions(Set.of(ProjectRole.PROJECT_MANAGER)));
    }

    @Test
    void everyDeveloperTypeAndAnalystShareTheSameContributorRights() {
        Set<ProjectPermission> expected = EnumSet.of(ProjectPermission.PROJECT_VIEW, ProjectPermission.TASK_WORK,
                ProjectPermission.ISSUE_PARTICIPATE);
        for (ProjectRole role : CONTRIBUTORS) {
            assertEquals(expected, RolePolicy.permissions(Set.of(role)), role.name());
            assertFalse(RolePolicy.allows(Set.of(role), ProjectPermission.TASK_MANAGE), role.name());
            assertFalse(RolePolicy.allows(Set.of(role), ProjectPermission.MEMBER_MANAGE), role.name());
        }
    }

    @Test
    void testerIsAContributorPlusTestReportCapability() {
        Set<ProjectRole> roles = Set.of(ProjectRole.TESTER);
        assertTrue(RolePolicy.allows(roles, ProjectPermission.TEST_REPORT_WRITE));
        assertTrue(RolePolicy.allows(roles, ProjectPermission.TASK_WORK));
        assertFalse(RolePolicy.allows(roles, ProjectPermission.TASK_MANAGE));
        assertFalse(RolePolicy.allows(CONTRIBUTORS, ProjectPermission.TEST_REPORT_WRITE));
    }

    @Test
    void multipleRolesUnionAndNeverEscalateToManager() {
        Set<ProjectRole> roles = Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER);
        assertTrue(RolePolicy.allows(roles, ProjectPermission.TEST_REPORT_WRITE));
        assertFalse(RolePolicy.allows(roles, ProjectPermission.MEMBER_MANAGE));
        assertFalse(RolePolicy.allows(Set.of(ProjectRole.ANALYST, ProjectRole.TESTER),
                ProjectPermission.PROJECT_UPDATE));
    }

    @Test
    void missingInputsAreDenied() {
        assertTrue(RolePolicy.permissions((java.util.Collection<ProjectRole>) null).isEmpty());
        assertTrue(RolePolicy.permissions(Set.<ProjectRole>of()).isEmpty());
        assertFalse(RolePolicy.allows(Set.of(ProjectRole.PROJECT_MANAGER), (ProjectPermission) null));
        assertFalse(RolePolicy.allows((GlobalRole) null, PlatformPermission.USER_MANAGE));
    }

    @Test
    void adminIsPlatformOnlyAndUserHasNoPlatformRights() {
        for (PlatformPermission permission : PlatformPermission.values()) {
            assertTrue(RolePolicy.allows(GlobalRole.ADMIN, permission));
            assertFalse(RolePolicy.allows(GlobalRole.USER, permission));
        }
        // ADMIN is not a project role, so it carries no project permission through the project policy.
        assertTrue(RolePolicy.permissions(Set.<ProjectRole>of()).isEmpty());
        for (ProjectRole role : ProjectRole.values()) {
            assertFalse(role.name().equals("ADMIN"));
            assertTrue(RolePolicy.permissions(Set.of(role)).stream()
                    .noneMatch(permission -> permission.name().startsWith("PLATFORM")));
        }
    }
}
