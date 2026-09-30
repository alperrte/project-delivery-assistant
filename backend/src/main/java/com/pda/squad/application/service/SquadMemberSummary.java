package com.pda.squad.application.service;

import java.time.Instant;
import java.util.UUID;
import java.util.Set;
import com.pda.user.ProjectRole;

public record SquadMemberSummary(UUID userId, String nickname, String email, Set<ProjectRole> roles,
                                 UUID addedBy, Instant addedAt) {}
