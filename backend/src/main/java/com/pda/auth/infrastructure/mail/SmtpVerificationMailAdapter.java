package com.pda.auth.infrastructure.mail;

import com.pda.auth.application.service.VerificationMailPort;
import com.pda.auth.application.service.VerificationMailUnavailableException;
import java.util.Properties;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Lazy;

@Component
@Lazy
public class SmtpVerificationMailAdapter implements VerificationMailPort {

    private final JavaMailSenderImpl sender;
    private final String fromAddress;

    public SmtpVerificationMailAdapter(Environment environment) {
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
    public void sendVerificationCode(String recipientEmail, String code) {
        if (sender == null) {
            throw new VerificationMailUnavailableException();
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject("PDA email verification");
        message.setText("Your PDA verification code is " + code + ". It expires in 10 minutes.");
        try {
            sender.send(message);
        } catch (MailException exception) {
            throw new VerificationMailUnavailableException();
        }
    }

    @Override
    public void sendPasswordResetCode(String recipientEmail, String code) {
        if (sender == null) {
            throw new VerificationMailUnavailableException();
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject("PDA password reset code");
        message.setText("Your PDA password reset code is " + code + ". It expires in 10 minutes. "
                + "If you did not request this, you can ignore this email.");
        try {
            sender.send(message);
        } catch (MailException exception) {
            throw new VerificationMailUnavailableException();
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
