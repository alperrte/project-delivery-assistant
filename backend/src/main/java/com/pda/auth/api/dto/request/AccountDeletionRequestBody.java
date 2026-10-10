package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.Size;

/** Which language the confirmation mail and its link use; the site language the user is looking at. */
public record AccountDeletionRequestBody(@Size(max = 8) String locale) {
}
