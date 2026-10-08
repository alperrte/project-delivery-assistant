package com.pda.notification.domain;

/** Project display name captured by the invitation transaction, never a live access grant. */
public record InvitationContext(String projectName) {
    public InvitationContext {
        if (projectName == null || projectName.isBlank() || projectName.length() > 160)
            throw new IllegalArgumentException("projectName is invalid");
    }
}
