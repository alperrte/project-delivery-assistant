package com.pda.audit;

/** The administrator-relevant actions that are written to the audit trail. A new value needs a migration (CHECK). */
public enum AuditAction {
    /** The final result of the administrator sign-in: verified session opened (SUCCESS), refused (FAILURE) or locked/unavailable (DENIED). */
    ADMIN_SIGN_IN,
    USER_DISABLE,
    USER_ENABLE,
    SESSION_REVOKE,
    SESSION_REVOKE_ALL,
    SUPPORT_REQUEST_STATUS_CHANGE
}
