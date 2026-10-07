package com.pda.project;

import java.util.UUID;

/**
 * Published inside the transaction that permanently deletes a project, before its row is removed. Modules that keep
 * scalar (non-foreign-key) references to the project clean them up synchronously in that same transaction.
 */
public record ProjectDeletedEvent(UUID projectId, UUID deletedBy) {}
