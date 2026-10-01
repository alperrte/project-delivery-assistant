package com.pda.project;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import com.pda.user.ProjectRole;

/** Public Project contract used by Auth during invitation-based registration. */
public interface ProjectInvitationOnboarding {
    record Preview(String projectName, String inviterName, Set<ProjectRole> roles, String message,
                   String email, String firstName, String lastName, Instant expiresAt, String status,
                   String teamName) {}
    record Accepted(UUID projectId, String projectSlug) {}

    Preview preview(String token);
    Accepted acceptNewAccount(String token, UUID userId, String email, String firstName, String lastName);
    Accepted acceptExistingAccount(String token, UUID userId);
}
