package com.pda.project.application.service;

/** A member exceeded the per-user repository read limit (see {@link RepositoryReadRateLimiter}); maps to 429. */
public class RepositoryReadLimitException extends RuntimeException {
    public RepositoryReadLimitException() {
        super("Repository read limit reached");
    }
}
