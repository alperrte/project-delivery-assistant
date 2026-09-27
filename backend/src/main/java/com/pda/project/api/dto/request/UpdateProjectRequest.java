package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.ProjectPriority;
import com.pda.project.domain.enums.ProjectStatus;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

/** {@code status} may be any operational value (PLANNING/ACTIVE/ON_HOLD/COMPLETED); ARCHIVED is rejected here on
 * purpose — archiving only happens through {@code POST /projects/{id}/archive}. */
public record UpdateProjectRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        @NotNull ProjectPriority priority,
        @NotNull ProjectStatus status,
        LocalDate startDate,
        LocalDate targetEndDate,
        @Size(max = 2000) String projectGoal,
        @Size(max = 1000) String techStack,
        UUID organizationId
) {
    @AssertTrue(message = "targetEndDate cannot precede startDate")
    public boolean isDateOrderValid() {
        return startDate == null || targetEndDate == null || !targetEndDate.isBefore(startDate);
    }
}
