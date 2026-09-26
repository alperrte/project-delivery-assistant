package com.pda.project.organization.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateOrganizationRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description
) {
}
