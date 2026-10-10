package com.pda.user.domain.enums;

public enum AccountStatus {
    PENDING_VERIFICATION,
    ACTIVE,
    DISABLED,
    /** Anonymised after the owner deleted the account; never signs in again and frees the email and nickname. */
    DELETED
}
