package com.pda.project.application.service;

import java.time.Instant;
import java.util.Set;
import com.pda.user.ProjectRole;

/**
 * Project-owned mail port for invitation notifications (HMZ-PROJ-16). Kept separate from Auth's
 * {@code VerificationMailPort}, which is narrowly scoped to verification codes; consolidating both behind one
 * shared adapter is a cross-module refactor for a coordinated follow-up, not done silently here. Reuses the
 * existing {@code MAIL_ENABLED}/{@code SMTP_*} ENV contract; no new ENV/secret.
 */
public interface ProjectInvitationMailPort {
    boolean available();

    /** Best-effort: implementations must not throw for a transport failure; the invitation flow must not break. */
    void sendInvitation(String recipientEmail, String projectName, String invitationLink);

    default void sendInvitation(String recipientEmail, String projectName, String teamName, String inviterName,
            Set<ProjectRole> roles, String personalMessage, Instant expiresAt, String invitationLink) {
        sendInvitation(recipientEmail, projectName, invitationLink);
    }
}
