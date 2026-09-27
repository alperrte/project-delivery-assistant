package com.pda.admin.application.service;

import com.pda.user.GlobalRole;
import com.pda.user.PlatformPermission;
import com.pda.user.RolePolicy;
import com.pda.user.UserAccounts;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/** Service-level platform permission check; a second line behind the URL rule so a routing mistake cannot open it. */
@Component
public class AdminAuthorization {

    public void require(UserAccounts.AuthenticatedUser principal, PlatformPermission permission) {
        GlobalRole role = null;
        if (principal != null) {
            try {
                role = GlobalRole.valueOf(principal.globalRole());
            } catch (IllegalArgumentException ignored) {
                role = null;
            }
        }
        if (!RolePolicy.allows(role, permission)) {
            throw new AccessDeniedException("Platform permission required");
        }
    }
}
