package com.pda.user;

import org.springframework.security.access.AccessDeniedException;

/**
 * An administrator reached the administrator API with a session that was not opened by the administrator sign-in
 * (for example a session that predates it). The answer is {@code 403 admin_reauthentication_required}.
 */
public class AdminReauthenticationRequiredException extends AccessDeniedException {
    public static final String CODE = "admin_reauthentication_required";

    public AdminReauthenticationRequiredException() {
        super("Administrator sign-in required");
    }
}
