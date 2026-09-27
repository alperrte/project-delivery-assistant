package com.pda.user;

import java.util.Collection;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * The single source of truth for what a role may do. Deny by default: an unknown or missing role, an empty role
 * set or a {@code null} argument yields no permission. Project and platform scopes never mix: a project role grants
 * no platform permission and {@link GlobalRole#ADMIN} grants no project permission.
 */
public final class RolePolicy {

    private static final Set<ProjectPermission> CONTRIBUTOR = EnumSet.of(
            ProjectPermission.PROJECT_VIEW, ProjectPermission.TASK_WORK, ProjectPermission.ISSUE_PARTICIPATE);

    private static final Map<ProjectRole, Set<ProjectPermission>> PROJECT = new EnumMap<>(ProjectRole.class);

    static {
        PROJECT.put(ProjectRole.PROJECT_MANAGER, EnumSet.allOf(ProjectPermission.class));
        for (ProjectRole role : new ProjectRole[] {ProjectRole.BACKEND_DEVELOPER, ProjectRole.FRONTEND_DEVELOPER,
                ProjectRole.FULL_STACK_DEVELOPER, ProjectRole.AI_ML_DEVELOPER, ProjectRole.UI_UX_DEVELOPER,
                ProjectRole.ANALYST}) {
            PROJECT.put(role, CONTRIBUTOR);
        }
        Set<ProjectPermission> tester = EnumSet.copyOf(CONTRIBUTOR);
        tester.add(ProjectPermission.TEST_REPORT_WRITE);
        PROJECT.put(ProjectRole.TESTER, tester);
    }

    private RolePolicy() {
    }

    /** Union of the permissions of every given role; a user may hold several roles in one project. */
    public static Set<ProjectPermission> permissions(Collection<ProjectRole> roles) {
        Set<ProjectPermission> result = EnumSet.noneOf(ProjectPermission.class);
        if (roles != null) {
            for (ProjectRole role : roles) {
                if (role != null) {
                    result.addAll(PROJECT.getOrDefault(role, Set.of()));
                }
            }
        }
        return Set.copyOf(result);
    }

    public static boolean allows(Collection<ProjectRole> roles, ProjectPermission permission) {
        return permission != null && permissions(roles).contains(permission);
    }

    public static Set<PlatformPermission> permissions(GlobalRole role) {
        return role == GlobalRole.ADMIN ? Set.copyOf(EnumSet.allOf(PlatformPermission.class)) : Set.of();
    }

    public static boolean allows(GlobalRole role, PlatformPermission permission) {
        return permission != null && permissions(role).contains(permission);
    }
}
