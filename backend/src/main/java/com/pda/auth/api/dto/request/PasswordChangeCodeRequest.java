package com.pda.auth.api.dto.request;

import jakarta.validation.constraints.Size;

/** Asks for the mailed code that unlocks the password form; the mail goes to the signed-in account. */
public record PasswordChangeCodeRequest(@Size(max = 8) String locale) {
}
