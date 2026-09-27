package com.pda.user;

/** Instance-level actions, independent of any project. Held only through {@link GlobalRole}. */
public enum PlatformPermission {
    USER_MANAGE,
    SESSION_MANAGE,
    AUDIT_VIEW
}
