package com.pda.project;

import com.pda.user.ProjectPermission;
import java.util.Set;
import java.util.UUID;

/**
 * Minimal view of an active project the user belongs to. {@code logoVersion} is the epoch-millisecond version of the
 * stored logo (null = no logo); {@code permissions} are what the user's roles grant in that project.
 */
public record ProjectSummaryView(UUID id, String slug, String name, Long logoVersion,
                                 Set<ProjectPermission> permissions, TaskManagementMode taskManagementMode) {}
