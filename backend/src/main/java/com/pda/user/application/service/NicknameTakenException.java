package com.pda.user.application.service;

public class NicknameTakenException extends RuntimeException {
    public NicknameTakenException() { super("Nickname unavailable"); }
}
