package com.pda.auth.infrastructure.mail;

import com.pda.auth.application.service.MailLocale;
import com.pda.auth.application.service.VerificationMailPort;
import com.pda.auth.application.service.VerificationMailUnavailableException;
import com.pda.auth.infrastructure.mail.VerificationMailTemplate.Kind;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import org.springframework.core.env.Environment;
import com.pda.shared.SmtpMailSettings;
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
        SmtpMailSettings settings = SmtpMailSettings.from(environment);
        sender = settings.sender();
        fromAddress = settings.fromAddress();
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
            helper.setFrom(SmtpMailSettings.namedAddress(fromAddress));
            helper.setReplyTo(fromAddress);
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

}
