package com.pda.auth.application.service;

/** Right credentials, but the account never proved its mailbox; the visitor is sent to the code screen. */
public class EmailNotVerifiedException extends RuntimeException {
    public EmailNotVerifiedException() {
        super("Email address is not verified");
    }
}
