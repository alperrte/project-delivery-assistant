package com.pda.auth.application.service;

public class VerificationMailUnavailableException extends RuntimeException {
    public VerificationMailUnavailableException() {
        super("Verification mail is temporarily unavailable");
    }
}
