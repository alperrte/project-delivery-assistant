package com.pda.project.organization.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateOrganizationRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        @Size(max = 2048) String website,
        @jakarta.validation.constraints.Email @Size(max = 254) String contactEmail,
        @Size(max = 200) String location,
        @Size(max = 1000) String notes
) {
}
