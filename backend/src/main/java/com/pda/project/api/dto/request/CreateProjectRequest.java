package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.ProjectType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** {@code projectType} is optional so older clients keep working; a missing type is stored as OTHER. */
public record CreateProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        UUID organizationId,
        ProjectType projectType,
        @Size(max = 120) String tagline,
        @Size(max = 1000) String techStack
) {
}
