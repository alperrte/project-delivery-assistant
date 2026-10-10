package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyChangeCodeRequest(@NotBlank @Pattern(regexp = "[0-9]{6}") String code) {
}
