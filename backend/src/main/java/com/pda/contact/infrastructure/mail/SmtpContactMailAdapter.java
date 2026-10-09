package com.pda.contact.infrastructure.mail;

import com.pda.contact.application.service.ContactMailPort;
import com.pda.contact.application.service.ContactMessage;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * Uses the same {@code MAIL_ENABLED}/{@code MAIL_PROVIDER}/{@code SMTP_*}/{@code MAIL_FROM} contract as the other
 * mail adapters; no new secret. The three addresses of the mail are never taken from the submission directly:
 * <ul>
 *   <li>From is the configured PDA sender ({@code MAIL_FROM}), never the visitor's address;</li>
 *   <li>To is {@code pda.contact.recipient}, validated once at start-up;</li>
 *   <li>Reply-To is the visitor's address, parsed strictly as one bare address.</li>
 * </ul>
 * The subject is fixed, the body is plain text, and every submitted value that is not the free-text message is cut
 * to a single line first, so a line break can never add a header.
 */
@Component
@Lazy
public class SmtpContactMailAdapter implements ContactMailPort {

    static final String SUBJECT = "Yeni PDA İletişim Talebi";

    private final JavaMailSenderImpl sender;
    private final String fromAddress;
    private final String recipient;

    public SmtpContactMailAdapter(Environment environment) {
        boolean enabled = environment.getProperty("MAIL_ENABLED", Boolean.class, false);
        if (!enabled) {
            sender = null;
            fromAddress = null;
            recipient = null;
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
        recipient = singleAddress(required(environment, "pda.contact.recipient"));
        boolean authenticate = environment.getProperty("SMTP_AUTH", Boolean.class, true);
        JavaMailSenderImpl configured = new JavaMailSenderImpl();
        configured.setHost(host);
        configured.setPort(port);
        configured.setDefaultEncoding("UTF-8");
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
    public void send(ContactMessage message) {
        if (sender == null) {
            throw new ContactDeliveryException(new IllegalStateException("mail disabled"));
        }
        try {
            sender.send(compose(sender.createMimeMessage(), fromAddress, recipient, message));
        } catch (MailException | MessagingException | IllegalStateException exception) {
            throw new ContactDeliveryException(exception);
        }
    }

    /** Builds the message; package-visible so the header rules can be tested without a mail server. */
    static MimeMessage compose(MimeMessage mime, String fromAddress, String recipient, ContactMessage message)
            throws MessagingException {
        MimeMessageHelper helper = new MimeMessageHelper(mime, false, "UTF-8");
        helper.setFrom(fromAddress);
        helper.setTo(recipient);
        helper.setReplyTo(singleAddress(message.email()));
        helper.setSubject(SUBJECT);
        helper.setText(body(message), false);
        return mime;
    }

    static String body(ContactMessage message) {
        return "Yeni PDA İletişim Talebi\n\n"
                + "Ad Soyad:\n" + singleLine(message.firstName()) + " " + singleLine(message.lastName()) + "\n\n"
                + "E-posta:\n" + singleLine(message.email()) + "\n\n"
                + "Mesaj:\n" + message.message() + "\n";
    }

    /** Exactly one bare address (no display name, no list, no comment): anything else is refused. */
    static String singleAddress(String value) {
        try {
            InternetAddress[] parsed = InternetAddress.parse(value, true);
            if (parsed.length != 1 || parsed[0].getPersonal() != null || !parsed[0].getAddress().equals(value)
                    || value.chars().anyMatch(c -> Character.isISOControl(c) || c == ',' || c == ';' || c == '<'
                    || c == '>' || c == '"' || c == ' ')) {
                throw new IllegalArgumentException("Not a single bare address");
            }
            parsed[0].validate();
            return parsed[0].getAddress();
        } catch (MessagingException | IllegalArgumentException exception) {
            throw new IllegalStateException("Invalid mail address", exception);
        }
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

    private static String required(Environment environment, String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(key + " is required when mail is enabled");
        }
        return value;
    }
}
