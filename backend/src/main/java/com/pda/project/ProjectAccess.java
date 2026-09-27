package com.pda.project;

import com.pda.user.ProjectPermission;
import java.util.Set;
import java.util.UUID;

/**
 * Public Project module contract for other modules (Auth, Task, ...). Membership is owned by Project; what a role may
 * do is decided by {@link com.pda.user.RolePolicy}. Callers pass the authenticated user id and must never trust a
 * client-supplied one. Unknown, archived or non-member combinations always answer "no access".
 */
public interface ProjectAccess {
    boolean isMember(UUID projectId, UUID userId);
    Set<String> rolesForUserInProject(UUID projectId, UUID userId);
    boolean canAccessProject(UUID projectId, UUID userId);

    /** Permissions the user holds in the project through its active membership roles; empty when none. */
    Set<ProjectPermission> permissionsForUserInProject(UUID projectId, UUID userId);

    /** True only when the user is an active member whose roles grant the permission in this very project. */
    boolean hasPermission(UUID projectId, UUID userId, ProjectPermission permission);
}
