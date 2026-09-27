package com.pda.project.api.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/** Must list every criterion of the project exactly once, in the desired order. */
public record ReorderCriteriaRequest(@NotEmpty List<@NotNull UUID> orderedCriterionIds) {
}
