package com.pda.contact;

/** What a contact-form message is about. {@code GENERAL} is the default for a client that sends no category. */
public enum SupportCategory {
    GENERAL,
    BUG,
    /** A KVKK / GDPR request about personal data (access, correction, deletion ...). */
    DATA_REQUEST,
    ACCESSIBILITY
}
