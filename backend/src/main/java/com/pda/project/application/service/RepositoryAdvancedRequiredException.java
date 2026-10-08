package com.pda.project.application.service;

/** A branch-level read was asked for while the repository is tracked in the basic mode. */
public class RepositoryAdvancedRequiredException extends RuntimeException {
    public static final String CODE = "REPOSITORY_ADVANCED_REQUIRED";

    public RepositoryAdvancedRequiredException() {
        super("Branch details need the advanced repository mode");
    }
}
