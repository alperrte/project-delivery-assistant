package com.pda.project.application.service;

/** Thrown when an invitation action conflicts with an existing pending invitation or active membership. */
public class InvitationConflictException extends RuntimeException {
    public InvitationConflictException(String message) {
        super(message);
    }
}
