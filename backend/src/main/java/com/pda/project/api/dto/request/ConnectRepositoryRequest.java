package com.pda.project.api.dto.request;

import com.pda.project.domain.enums.RepositoryTrackingMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * A public GitHub repository URL, e.g. {@code https://github.com/owner/repo}. Never fetched as-is; only parsed.
 * {@code trackingMode} defaults to BASIC and {@code notifyOnCommits} to true when omitted.
 */
public record ConnectRepositoryRequest(@NotBlank @Size(max = 500) String repositoryUrl,
                                       RepositoryTrackingMode trackingMode, Boolean notifyOnCommits) {
}
