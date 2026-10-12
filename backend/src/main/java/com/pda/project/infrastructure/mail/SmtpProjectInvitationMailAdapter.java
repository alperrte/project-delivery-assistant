package com.pda.project.infrastructure.mail;

import com.pda.project.application.service.ProjectInvitationMailPort;
import com.pda.user.ProjectRole;
import java.time.Instant;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import com.pda.shared.SmtpMailSettings;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * Reuses the same {@code MAIL_ENABLED}/{@code MAIL_PROVIDER}/{@code SMTP_*}/{@code MAIL_FROM} ENV contract as
 * {@code com.pda.auth.infrastructure.mail.SmtpVerificationMailAdapter}; shared transport settings. A separate component
 * (not a shared adapter) because that Auth class implements a port scoped to verification codes only.
 */
@Component
@Lazy
public class SmtpProjectInvitationMailAdapter implements ProjectInvitationMailPort {

    private static final Logger log = LoggerFactory.getLogger(SmtpProjectInvitationMailAdapter.class);

    private final JavaMailSenderImpl sender;
    private final String fromAddress;

    public SmtpProjectInvitationMailAdapter(Environment environment) {
        SmtpMailSettings settings = SmtpMailSettings.from(environment);
        sender = settings.sender();
        fromAddress = settings.fromAddress();
    }

    @Override
    public boolean available() {
        return sender != null;
    }

    @Override
    public void sendInvitation(String recipientEmail, String projectName, String invitationLink) {
        sendInvitation(recipientEmail, projectName, null, "PDA", Set.of(), null, null, invitationLink);
    }

    @Override
    public void sendInvitation(String recipientEmail, String projectName, String teamName, String inviterName,
            Set<ProjectRole> roles, String personalMessage, Instant expiresAt, String invitationLink) {
        if (sender == null) {
            return;
        }
        SimpleMailMessage message = compose(fromAddress, recipientEmail, projectName, teamName, inviterName, roles,
                personalMessage, expiresAt, invitationLink);
        try {
            sender.send(message);
        } catch (MailException exception) {
            log.warn("Failed to send project invitation email; the invitation itself was still created.");
        }
    }

    /**
     * Builds the message. Names and texts typed by users end up in the subject and the body, so every line-ending or
     * other control character is replaced first: a project name containing CR/LF must never be able to add a header
     * (Bcc, a second Subject ...) to the message.
     */
    static SimpleMailMessage compose(String fromAddress, String recipientEmail, String projectName, String teamName,
            String inviterName, Set<ProjectRole> roles, String personalMessage, Instant expiresAt,
            String invitationLink) {
        String project = singleLine(projectName);
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(SmtpMailSettings.namedAddress(fromAddress).toString());
        message.setReplyTo(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject("You're invited to join " + project + " on PDA");
        message.setText(singleLine(inviterName) + " invited you to join the project \"" + project + "\" on PDA.\n"
                + (teamName == null ? "" : "Team: " + singleLine(teamName) + "\n")
                + "Roles: " + roles + "\n"
                + (personalMessage == null ? "" : "Message: " + singleLine(personalMessage) + "\n")
                + (expiresAt == null ? "" : "Invitation expires: " + expiresAt + "\n")
                + "\nOpen this link to respond: " + invitationLink + "\n\n"
                + "If you did not expect this invitation, you can ignore this email.");
        return message;
    }

    /** One line of plain text: control characters and Unicode line/paragraph separators become single spaces. */
    static String singleLine(String text) {
        if (text == null) return "";
        StringBuilder clean = new StringBuilder(text.length());
        text.codePoints().forEach(cp -> {
            boolean lineBreakLike = Character.isISOControl(cp) || cp == 0x2028 || cp == 0x2029;
            clean.appendCodePoint(lineBreakLike ? ' ' : cp);
        });
        return clean.toString().replaceAll(" {2,}", " ").strip();
    }

}
