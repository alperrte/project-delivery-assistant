package com.pda.project;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Port implemented by the Squad module so Project can validate and label the team an invitation joins without
 * depending on Squad (Squad already depends on Project; this inverts the arrow instead of creating a cycle).
 */
public interface ProjectTeamDirectory {

    /** True only for a non-archived team that belongs to exactly this project. */
    boolean isActiveTeam(UUID projectId, UUID teamId);

    /** Team names by id, in one lookup; unknown ids are absent from the result. */
    Map<UUID, String> teamNames(Set<UUID> teamIds);
}
