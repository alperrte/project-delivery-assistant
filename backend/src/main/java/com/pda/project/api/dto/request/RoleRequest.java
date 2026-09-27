package com.pda.project.api.dto.request;

import com.pda.user.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record RoleRequest(@NotNull ProjectRole role) {
}
