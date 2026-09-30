package com.pda.project;

import java.util.UUID;

/** Published inside project creation so the Teams module creates the root in the same transaction. */
public record ProjectCreatedEvent(UUID projectId, UUID creatorUserId) {}
