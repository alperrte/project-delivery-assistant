package com.pda.auth.integration;

import com.pda.auth.application.service.MailLocale;
import com.pda.auth.application.service.VerificationMailPort;
import com.pda.auth.application.service.VerificationMailUnavailableException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces SMTP in integration tests: remembers every mail so a test can read the code the user would receive. */
@TestConfiguration
public class CapturingMailConfiguration {

    public record Sent(String kind, String recipient, String secret, MailLocale locale) {}

    public static class CapturingMailPort implements VerificationMailPort {
        private final List<Sent> sent = new CopyOnWriteArrayList<>();
        private volatile boolean failing;

        public void failNextMails(boolean failing) {
            this.failing = failing;
        }

        public void clear() {
            sent.clear();
            failing = false;
        }

        public List<Sent> all() {
            return List.copyOf(sent);
        }

        /** The most recent secret (code or link) mailed to {@code recipient}, or null. */
        public String lastSecretFor(String recipient) {
            for (int i = sent.size() - 1; i >= 0; i--) {
                if (sent.get(i).recipient().equalsIgnoreCase(recipient)) {
                    return sent.get(i).secret();
                }
            }
            return null;
        }

        public long countFor(String recipient) {
            return sent.stream().filter(mail -> mail.recipient().equalsIgnoreCase(recipient)).count();
        }

        @Override
        public boolean available() {
            return true;
        }

        @Override
        public void sendVerificationCode(String recipientEmail, String code, MailLocale locale) {
            record("REGISTER", recipientEmail, code, locale);
        }

        @Override
        public void sendPasswordResetCode(String recipientEmail, String code, MailLocale locale) {
            record("PASSWORD_RESET", recipientEmail, code, locale);
        }

        @Override
        public void sendPasswordChangeCode(String recipientEmail, String code, MailLocale locale) {
            record("PASSWORD_CHANGE", recipientEmail, code, locale);
        }

        @Override
        public void sendAccountDeletionLink(String recipientEmail, String link, MailLocale locale) {
            record("ACCOUNT_DELETION", recipientEmail, link, locale);
        }

        private void record(String kind, String recipient, String secret, MailLocale locale) {
            if (failing) {
                throw new VerificationMailUnavailableException();
            }
            sent.add(new Sent(kind, recipient, secret, locale));
        }
    }

    @Bean
    @Primary
    public CapturingMailPort capturingMailPort() {
        return new CapturingMailPort();
    }
}
