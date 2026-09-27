package com.pda.project;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Public Project module contract for the platform administration overview. It exposes aggregate metadata only
 * (name, status, member count); no description, goal, member identities or any project content, and it is not an
 * access path into a project. Callers must authorize the platform administrator themselves.
 */
public interface ProjectOverview {

    ProjectCounts counts();

    /** Newest first, including archived projects. */
    ProjectPage list(int page, int size);

    record ProjectSummary(UUID id, String name, String slug, String status, boolean archived, long activeMembers,
                          Instant createdAt) {}

    record ProjectPage(List<ProjectSummary> items, int page, int size, long totalElements) {}

    record ProjectCounts(long total, long active, long archived) {}
}
