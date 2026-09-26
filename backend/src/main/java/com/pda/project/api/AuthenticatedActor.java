package com.pda.project.api;

import com.pda.user.UserAccounts;
import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

public final class AuthenticatedActor {

    private AuthenticatedActor() {
    }

    public static UUID id(UserAccounts.AuthenticatedUser principal) {
        if (principal == null || principal.id() == null) {
            throw new AccessDeniedException("Authentication required");
        }
        return principal.id();
    }
}
