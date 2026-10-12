package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.ProjectType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import java.util.List;

import java.util.UUID;

/** projectTypes takes precedence over the legacy scalar. Missing both retains the OTHER default. */
public record CreateProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        UUID organizationId,
        ProjectType projectType,
        @Size(max = 120) String tagline,
        @Size(max = 1000) String techStack,
        com.pda.project.LogoShape logoShape,
        @io.swagger.v3.oas.annotations.media.Schema(description = "One or more product types. Takes precedence over legacy projectType; duplicates are normalized.")
        @Size(min = 1, max = 5) List<@NotNull ProjectType> projectTypes
) {
}
