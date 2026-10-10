package com.pda.auth.application.service;

/**
 * Two-factor authentication cannot be used: TOTP_ENCRYPTION_KEY is missing, or it no longer opens the stored secret
 * (the key was changed). The HTTP answer is a controlled {@code 503 two_factor_unavailable}, never a 500.
 */
public class TwoFactorUnavailableException extends IllegalStateException {
    public TwoFactorUnavailableException() {
        super("Two-factor authentication is unavailable");
    }

    public TwoFactorUnavailableException(Throwable cause) {
        super("Two-factor authentication is unavailable", cause);
    }
}
