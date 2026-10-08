package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.RepositoryTrackingMode;
import jakarta.validation.constraints.NotNull;

/** Both fields are required: the PATCH always states the complete desired settings. */
public record UpdateRepositorySettingsRequest(@NotNull RepositoryTrackingMode trackingMode,
                                              @NotNull Boolean notifyOnCommits) {
}
