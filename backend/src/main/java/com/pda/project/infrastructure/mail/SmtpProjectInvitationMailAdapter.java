package com.pda.project.infrastructure.mail;

import com.pda.project.application.service.ProjectInvitationMailPort;
import com.pda.user.ProjectRole;
import java.time.Instant;
import java.util.Set;
import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/**
 * Reuses the same {@code MAIL_ENABLED}/{@code MAIL_PROVIDER}/{@code SMTP_*}/{@code MAIL_FROM} ENV contract as
 * {@code com.pda.auth.infrastructure.mail.SmtpVerificationMailAdapter}; no new ENV/secret. A separate component
 * (not a shared adapter) because that Auth class implements a port scoped to verification codes only.
 */
@Component
@Lazy
public class SmtpProjectInvitationMailAdapter implements ProjectInvitationMailPort {

    private static final Logger log = LoggerFactory.getLogger(SmtpProjectInvitationMailAdapter.class);

    private final JavaMailSenderImpl sender;
    private final String fromAddress;

    public SmtpProjectInvitationMailAdapter(Environment environment) {
        boolean enabled = environment.getProperty("MAIL_ENABLED", Boolean.class, false);
        if (!enabled) {
            sender = null;
            fromAddress = null;
            return;
        }
        if (!"smtp".equalsIgnoreCase(environment.getProperty("MAIL_PROVIDER", "smtp"))) {
            throw new IllegalStateException("Unsupported mail provider");
        }
        String host = required(environment, "SMTP_HOST");
        String from = required(environment, "MAIL_FROM");
        int port = environment.getProperty("SMTP_PORT", Integer.class, 587);
        if (port < 1 || port > 65535) {
            throw new IllegalStateException("SMTP_PORT is invalid");
        }
        boolean authenticate = environment.getProperty("SMTP_AUTH", Boolean.class, true);
        JavaMailSenderImpl configured = new JavaMailSenderImpl();
        configured.setHost(host);
        configured.setPort(port);
        if (authenticate) {
            configured.setUsername(required(environment, "SMTP_USERNAME"));
            configured.setPassword(required(environment, "SMTP_PASSWORD"));
        }
        Properties properties = configured.getJavaMailProperties();
        properties.put("mail.smtp.auth", Boolean.toString(authenticate));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(
                environment.getProperty("SMTP_STARTTLS", Boolean.class, true)));
        properties.put("mail.smtp.connectiontimeout", "5000");
        properties.put("mail.smtp.timeout", "5000");
        properties.put("mail.smtp.writetimeout", "5000");
        sender = configured;
        fromAddress = from;
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
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject("You're invited to join " + projectName + " on PDA");
        message.setText(inviterName + " invited you to join the project \"" + projectName + "\" on PDA.\n"
                + (teamName == null ? "" : "Team: " + teamName + "\n")
                + "Roles: " + roles + "\n"
                + (personalMessage == null ? "" : "Message: " + personalMessage + "\n")
                + (expiresAt == null ? "" : "Invitation expires: " + expiresAt + "\n")
                + "\nOpen this link to respond: " + invitationLink + "\n\n"
                + "If you did not expect this invitation, you can ignore this email.");
        try {
            sender.send(message);
        } catch (MailException exception) {
            log.warn("Failed to send project invitation email; the invitation itself was still created.");
        }
    }

    private static String required(Environment environment, String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(key + " is required when mail is enabled");
        }
        return value;
    }
}
