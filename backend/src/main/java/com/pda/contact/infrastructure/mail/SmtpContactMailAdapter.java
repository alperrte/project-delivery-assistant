package com.pda.contact.infrastructure.mail;

import com.pda.contact.SupportCategory;
import com.pda.contact.application.service.ContactMailPort;
import com.pda.contact.application.service.ContactMessage;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import com.pda.shared.SmtpMailSettings;
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
 * The subject is fixed text plus the category label (a fixed list, never visitor text), the body is plain text, and every
 * submitted value that is not the free-text message is cut to a single line first, so a line break can never add a header.
 * Both smtp and brevo use the configured SMTP relay; no automatic fallback or HTTP API.
 */
@Component
@Lazy
public class SmtpContactMailAdapter implements ContactMailPort {

    static final String SUBJECT = "Yeni PDA İletişim Talebi";

    /** Fixed, human-readable label of each category for the subject and the body. */
    static String label(SupportCategory category) {
        return switch (category == null ? SupportCategory.GENERAL : category) {
            case GENERAL -> "Genel";
            case BUG -> "Hata bildirimi";
            case DATA_REQUEST -> "KVKK/GDPR veri talebi";
            case ACCESSIBILITY -> "Erişilebilirlik";
        };
    }

    static String subject(ContactMessage message) {
        return SUBJECT + " [" + label(message.category()) + "]";
    }

    private final JavaMailSenderImpl sender;
    private final String fromAddress;
    private final String recipient;

    public SmtpContactMailAdapter(Environment environment) {
        SmtpMailSettings settings = SmtpMailSettings.from(environment);
        sender = settings.sender();
        fromAddress = settings.fromAddress();
        recipient = sender == null ? null : singleAddress(required(environment, "pda.contact.recipient"));
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
        helper.setFrom(SmtpMailSettings.namedAddress(fromAddress));
        helper.setTo(recipient);
        helper.setReplyTo(singleAddress(message.email()));
        helper.setSubject(subject(message));
        helper.setText(body(message), false);
        return mime;
    }

    static String body(ContactMessage message) {
        String name = singleLine(message.firstName())
                + (message.lastName() == null ? "" : " " + singleLine(message.lastName()));
        return "Yeni PDA İletişim Talebi\n\n"
                + "Kategori:\n" + label(message.category()) + "\n\n"
                + "Ad Soyad:\n" + name + "\n\n"
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
