package com.pda.squad.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateSquadRequest(@NotBlank @Size(max = 120) String name, @Size(max = 2000) String description) {
}
