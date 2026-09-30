package com.pda.project;

import com.pda.user.ProjectRole;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/** Safe public membership summary for project-scoped organizing modules. */
public record ProjectMemberView(UUID membershipId, UUID userId, String nickname, String email,
                                Set<ProjectRole> roles, Instant joinedAt) {}
