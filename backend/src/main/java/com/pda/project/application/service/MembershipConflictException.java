package com.pda.project.application.service;

public class MembershipConflictException extends RuntimeException {
    public MembershipConflictException(String message) {
        super(message);
    }
}
