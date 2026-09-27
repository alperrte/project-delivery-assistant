package com.pda.squad.application.service;

/** Thrown when a squad action conflicts with existing state (e.g. a duplicate membership). */
public class SquadConflictException extends RuntimeException {
    public SquadConflictException(String message) {
        super(message);
    }
}
