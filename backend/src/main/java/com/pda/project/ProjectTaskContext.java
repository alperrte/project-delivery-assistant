package com.pda.project;

import java.util.UUID;

public record ProjectTaskContext(UUID projectId, String slug, boolean archived, TaskManagementMode taskManagementMode) {
    /** Compatibility for callers that construct a legacy context explicitly. */
    public ProjectTaskContext(UUID projectId, String slug, boolean archived) {
        this(projectId, slug, archived, TaskManagementMode.BOTH);
    }
}
