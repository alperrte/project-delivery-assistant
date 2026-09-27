package com.pda.project.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCriterionRequest(@NotBlank @Size(max = 200) String title, @Size(max = 2000) String description) {
}
