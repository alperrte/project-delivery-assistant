package com.pda.project.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        UUID organizationId
) {
}
