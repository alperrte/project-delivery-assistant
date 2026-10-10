package com.pda.auth.application.service;

/**
 * The administrator sign-in ticket is missing, expired, already used, for another account or for another purpose.
 * The HTTP answer is {@code 401 two_factor_session_expired}: sign in with the password again.
 */
public class AdminTicketException extends RuntimeException {
    public AdminTicketException() {
        super("Administrator sign-in ticket is not valid");
    }
}
