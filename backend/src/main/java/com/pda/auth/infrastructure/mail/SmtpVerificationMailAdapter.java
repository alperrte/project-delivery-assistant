package com.pda.auth.infrastructure.mail;

import com.pda.auth.application.service.MailLocale;
import com.pda.auth.application.service.VerificationMailPort;
import com.pda.auth.application.service.VerificationMailUnavailableException;
import com.pda.auth.infrastructure.mail.VerificationMailTemplate.Kind;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.util.Properties;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Lazy;

@Component
@Lazy
public class SmtpVerificationMailAdapter implements VerificationMailPort {

    private static final String LOGO_RESOURCE = "branding/pda-logo.png";
    private static volatile byte[] logoBytes;

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
        configured.setDefaultEncoding("UTF-8");
        sender = configured;
        fromAddress = from;
    }

    @Override
    public boolean available() {
        return sender != null;
    }

    @Override
    public void sendVerificationCode(String recipientEmail, String code, MailLocale locale) {
        send(recipientEmail, VerificationMailTemplate.render(Kind.REGISTER, locale, code));
    }

    @Override
    public void sendPasswordResetCode(String recipientEmail, String code, MailLocale locale) {
        send(recipientEmail, VerificationMailTemplate.render(Kind.PASSWORD_RESET, locale, code));
    }

    @Override
    public void sendPasswordChangeCode(String recipientEmail, String code, MailLocale locale) {
        send(recipientEmail, VerificationMailTemplate.render(Kind.PASSWORD_CHANGE, locale, code));
    }

    @Override
    public void sendAccountDeletionLink(String recipientEmail, String link, MailLocale locale) {
        send(recipientEmail, VerificationMailTemplate.render(Kind.ACCOUNT_DELETION, locale, link));
    }

    private void send(String recipientEmail, VerificationMailTemplate.Rendered mail) {
        if (sender == null) {
            throw new VerificationMailUnavailableException();
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(recipientEmail);
            helper.setSubject(mail.subject());
            helper.setText(mail.text(), mail.html());
            helper.addInline(VerificationMailTemplate.LOGO_CID, new ByteArrayResource(logo()), "image/png");
            sender.send(message);
        } catch (MailException | MessagingException | IOException exception) {
            throw new VerificationMailUnavailableException();
        }
    }

    private static byte[] logo() throws IOException {
        byte[] cached = logoBytes;
        if (cached == null) {
            try (var stream = new ClassPathResource(LOGO_RESOURCE).getInputStream()) {
                cached = stream.readAllBytes();
            }
            logoBytes = cached;
        }
        return cached;
    }

    private static String required(Environment environment, String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(key + " is required when mail is enabled");
        }
        return value;
    }
}
