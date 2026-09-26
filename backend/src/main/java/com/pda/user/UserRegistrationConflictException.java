package com.pda.user;

public class UserRegistrationConflictException extends RuntimeException {
    public UserRegistrationConflictException() {
        super("Account identity is unavailable");
    }
}
