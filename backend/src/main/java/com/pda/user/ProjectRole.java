package com.pda.user;

/**
 * Canonical project-scoped roles. A role is only a label on a project membership; what it may do is decided
 * exclusively by {@link RolePolicy}, so a role name never grants access by itself. {@code ADMIN} is deliberately
 * not here: it is a platform role ({@link GlobalRole}), never a project membership.
 */
public enum ProjectRole {
    PROJECT_MANAGER,
    BACKEND_DEVELOPER,
    FRONTEND_DEVELOPER,
    FULL_STACK_DEVELOPER,
    AI_ML_DEVELOPER,
    UI_UX_DEVELOPER,
    TESTER,
    ANALYST
}
