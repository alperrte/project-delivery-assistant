package com.pda.contact.api.dto.request;

/**
 * Exactly the four fields of the form. There is no recipient, sender, copy or header field: properties the browser
 * adds (to, cc, bcc, from ...) are never bound, so they cannot influence the mail. Validation and normalisation
 * happen in {@code ContactMessage}, which is the single source of the rules.
 */
public record ContactMessageRequest(String firstName, String lastName, String email, String message) {
}
