package com.pda.project.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A public GitHub repository URL, e.g. {@code https://github.com/owner/repo}. Never fetched as-is; only parsed. */
public record ConnectRepositoryRequest(@NotBlank @Size(max = 500) String repositoryUrl) {
}
