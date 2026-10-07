package com.pda.project.application.service;

/** Only public repositories can be connected (the integration is read-only and token-free for members). */
public class PrivateRepositoryException extends RuntimeException {
    public static final String CODE = "REPOSITORY_PRIVATE";

    public PrivateRepositoryException() {
        super("Only public repositories can be connected");
    }
}
