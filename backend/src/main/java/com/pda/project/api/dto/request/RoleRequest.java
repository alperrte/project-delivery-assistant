package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.ProjectRole;
import jakarta.validation.constraints.NotNull;

public record RoleRequest(@NotNull ProjectRole role) {
}
