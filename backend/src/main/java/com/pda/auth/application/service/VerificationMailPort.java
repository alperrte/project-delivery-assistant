package com.pda.auth.application.service;

public interface VerificationMailPort {
    boolean available();
    void sendVerificationCode(String recipientEmail, String code);

    /** Same transport as {@link #sendVerificationCode}, a distinct template for a password-reset code. */
    void sendPasswordResetCode(String recipientEmail, String code);
}
