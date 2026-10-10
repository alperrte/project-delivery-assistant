package com.pda.project.application.service;

/**
 * Thrown when an invitation action conflicts with an existing pending invitation, an active membership or an
 * invitation that is no longer pending. The optional {@code code} is a stable machine-readable reason the UI maps to
 * a localised message. It extends {@link IllegalStateException} because a not-pending invitation has always surfaced
 * as one; the more specific handler keeps the HTTP status at 409 either way.
 */
public class InvitationConflictException extends IllegalStateException {

    /** A live pending invitation already exists for this user or e-mail address in the project. */
    public static final String ALREADY_PENDING = "INVITATION_ALREADY_PENDING";
    /** The invitation target is already an active member of the project. */
    public static final String TARGET_ALREADY_MEMBER = "INVITATION_TARGET_ALREADY_MEMBER";
    /** The invitation was already accepted, rejected, cancelled or has expired (or can no longer be honoured). */
    public static final String NOT_PENDING = "INVITATION_NOT_PENDING";

    private final String code;

    public InvitationConflictException(String message) {
        this(message, null);
    }

    public InvitationConflictException(String message, String code) {
        super(message);
        this.code = code;
    }

    /** Stable machine-readable reason for the UI, or {@code null} for a generic invitation conflict. */
    public String code() {
        return code;
    }
}
