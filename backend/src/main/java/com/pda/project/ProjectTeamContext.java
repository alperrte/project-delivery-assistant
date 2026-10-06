package com.pda.project;

import java.util.UUID;

/** Scalar project display context held under the existing project mutation lock. Grants no permission. */
public record ProjectTeamContext(UUID projectId, String name) {}
