package com.pda.audit;

public enum AuditOutcome {
    SUCCESS,
    /** The action was attempted and did not happen (wrong credentials, unknown target ...). */
    FAILURE,
    /** The action was refused by a rule (locked sign-in, self-disable, last administrator ...). */
    DENIED
}
