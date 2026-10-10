package com.pda.contact.api.dto.request;

import com.pda.contact.SupportCategory;

/**
 * Exactly the fields of the form. There is no recipient, sender, copy or header field: properties the browser adds
 * (to, cc, bcc, from ...) are never bound, so they cannot influence the mail. Validation and normalisation happen in
 * {@code ContactMessage}, which is the single source of the rules.
 *
 * @param lastName  optional (data minimisation)
 * @param category  optional; GENERAL when absent. An unknown value makes the body unreadable (400)
 * @param website   the honeypot: a field real visitors never see and never fill. Any text in it marks a bot
 * @param startedAt when the form was shown, in epoch milliseconds of the visitor's clock. A form submitted within a few
 *                  seconds of being shown is a bot. Optional only while {@code pda.contact.require-started-at} is false
 */
public record ContactMessageRequest(String firstName, String lastName, String email, String message,
                                    SupportCategory category, String website, Long startedAt) {
}
