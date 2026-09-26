package com.pda.auth.application.service;

public interface VerificationMailPort {
    boolean available();
    void sendVerificationCode(String recipientEmail, String code);
}
