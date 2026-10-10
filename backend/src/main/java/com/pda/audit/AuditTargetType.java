package com.pda.audit;

public enum AuditTargetType {
    USER,
    SUPPORT_REQUEST,
    /** No specific target (for example a refused sign-in of an unknown account). */
    SYSTEM
}
