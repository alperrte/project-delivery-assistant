package com.pda.project.api.dto.request;

import com.pda.project.TaskManagementMode;
import jakarta.validation.constraints.NotNull;

public record TaskManagementModeRequest(@NotNull TaskManagementMode mode) {}
