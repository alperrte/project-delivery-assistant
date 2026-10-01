package com.pda.project;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Port implemented by the Squad module so Project and Task can validate and label a team without depending on Squad
 * (Squad already depends on Project; this inverts the arrow instead of creating a cycle).
 */
public interface ProjectTeamDirectory {

    /** True only for a non-archived team that belongs to exactly this project. */
    boolean isActiveTeam(UUID projectId, UUID teamId);

    /** True only when the user holds an active project membership that belongs to this active team of this project. */
    boolean isActiveTeamMember(UUID projectId, UUID teamId, UUID userId);

    /** Team names by id, in one lookup; unknown ids are absent from the result. */
    Map<UUID, String> teamNames(Set<UUID> teamIds);

    /** Which of the supplied teams are active (non-archived), in one lookup. */
    Set<UUID> activeTeamIds(Set<UUID> teamIds);

    /** Active teams of the project the user belongs to through an active membership. */
    Set<UUID> activeTeamIdsOfUser(UUID projectId, UUID userId);
}
