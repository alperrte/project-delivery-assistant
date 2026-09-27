package com.pda.project.api.dto.request;

import com.pda.user.ProjectRole;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record ReplaceRolesRequest(@NotEmpty Set<@NotNull ProjectRole> roles) {
}
