package com.pda.auth.application.service;

/** Two-factor authentication cannot be set up: TOTP_ENCRYPTION_KEY is not configured. */
public class TwoFactorUnavailableException extends RuntimeException {
    public TwoFactorUnavailableException() {
        super("Two-factor authentication is unavailable");
    }
}
