package com.pda.project;

import java.util.Set;
import java.util.UUID;

/** Public Project module contract for other modules; role codes are temporary until Auth publishes them. */
public interface ProjectAccess {
    boolean isMember(UUID projectId, UUID userId);
    Set<String> rolesForUserInProject(UUID projectId, UUID userId);
    boolean canAccessProject(UUID projectId, UUID userId);
}
