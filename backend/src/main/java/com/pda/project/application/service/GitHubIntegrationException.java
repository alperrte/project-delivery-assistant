package com.pda.project.application.service;

/** A safe, internal-detail-free failure from the GitHub public REST client (HMZ-PROJ-28). */
public class GitHubIntegrationException extends RuntimeException {

    public enum Reason { NOT_FOUND, RATE_LIMITED, UNAVAILABLE }

    private final Reason reason;

    public GitHubIntegrationException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
