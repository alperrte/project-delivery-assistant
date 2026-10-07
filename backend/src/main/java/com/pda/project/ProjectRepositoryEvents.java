package com.pda.project;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Immutable, scalar-only repository events for notification consumers. */
public final class ProjectRepositoryEvents {
    private ProjectRepositoryEvents() {}

    /**
     * New commits reached the repository's default branch. {@code commitCount} is exact unless {@code truncated}
     * (more than the scanned window, or rewritten history), in which case it is the number actually inspected.
     */
    public record CommitsPushed(UUID projectId, String projectName, String repositoryFullName, String branch,
                                int commitCount, boolean truncated, String headMessage, String headAuthor,
                                Set<UUID> recipientIds, Instant occurredAt) {}
}
