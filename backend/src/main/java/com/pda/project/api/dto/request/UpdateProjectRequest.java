package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.project.domain.enums.ProjectType;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;
import java.util.List;

/** {@code status} may be any operational value (PLANNING/ACTIVE/ON_HOLD/COMPLETED); ARCHIVED is rejected here on
 * purpose — archiving only happens through {@code POST /projects/{id}/archive}. projectTypes replaces the selection;
 * missing/null preserves it unless a legacy client explicitly changes the scalar. tagline null clears it. */
public record UpdateProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        @NotNull ProjectPriority priority,
        @NotNull ProjectStatus status,
        LocalDate startDate,
        LocalDate targetEndDate,
        @Size(max = 2000) String projectGoal,
        @Size(max = 1000) String techStack,
        UUID organizationId,
        ProjectType projectType,
        @Size(max = 120) String tagline,
        com.pda.project.LogoShape logoShape,
        @io.swagger.v3.oas.annotations.media.Schema(description = "Replaces the selected product types. Missing/null preserves the selection; takes precedence over legacy projectType.")
        @Size(min = 1, max = 5) List<@NotNull ProjectType> projectTypes
) {
    @AssertTrue(message = "targetEndDate cannot precede startDate")
    public boolean isDateOrderValid() {
        return startDate == null || targetEndDate == null || !targetEndDate.isBefore(startDate);
    }
}
