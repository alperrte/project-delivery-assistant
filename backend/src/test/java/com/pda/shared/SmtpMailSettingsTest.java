package com.pda.shared;

import static org.junit.jupiter.api.Assertions.*;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetupTest;
import com.pda.auth.application.service.MailLocale;
import com.pda.auth.infrastructure.mail.SmtpVerificationMailAdapter;
import com.pda.contact.application.service.ContactMessage;
import com.pda.contact.infrastructure.mail.SmtpContactMailAdapter;
import com.pda.project.infrastructure.mail.SmtpProjectInvitationMailAdapter;
import jakarta.mail.Message;
import jakarta.mail.internet.InternetAddress;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class SmtpMailSettingsTest {
    private MockEnvironment enabled() {
        return new MockEnvironment().withProperty("MAIL_ENABLED", "true")
                .withProperty("SMTP_HOST", "localhost").withProperty("SMTP_AUTH", "false")
                .withProperty("SMTP_FROM_ADDRESS", "info@pd-assistant.com");
    }

    @Test
    void implicitTlsAndStarttlsAreDistinctAndRequiredWhenSelected() {
        var ssl = SmtpMailSettings.from(enabled().withProperty("SMTP_PORT", "465")
                .withProperty("SMTP_SSL", "true").withProperty("SMTP_STARTTLS", "false"));
        assertEquals(465, ssl.sender().getPort());
        assertEquals("true", ssl.sender().getJavaMailProperties().getProperty("mail.smtp.ssl.enable"));
        assertEquals("false", ssl.sender().getJavaMailProperties().getProperty("mail.smtp.starttls.enable"));
        assertEquals("true", ssl.sender().getJavaMailProperties().getProperty("mail.smtp.ssl.checkserveridentity"));
        var tls = SmtpMailSettings.from(enabled());
        assertEquals(587, tls.sender().getPort());
        assertEquals("true", tls.sender().getJavaMailProperties().getProperty("mail.smtp.starttls.required"));
        assertEquals("false", tls.sender().getJavaMailProperties().getProperty("mail.smtp.ssl.enable"));
        assertThrows(IllegalStateException.class, () -> SmtpMailSettings.from(enabled().withProperty("SMTP_SSL", "true")));
    }

    @Test
    void senderOverridesLegacyAddressWithoutChangingTheAuthenticationLogin() {
        var settings = SmtpMailSettings.from(enabled().withProperty("MAIL_FROM", "legacy@example.test")
                .withProperty("SMTP_AUTH", "true").withProperty("SMTP_USERNAME", "provider-login@example.test")
                .withProperty("SMTP_PASSWORD", "test-only-password"));
        assertEquals("info@pd-assistant.com", settings.fromAddress());
        assertEquals("provider-login@example.test", settings.sender().getUsername());
        MockEnvironment legacy = new MockEnvironment().withProperty("MAIL_ENABLED", "true")
                .withProperty("SMTP_HOST", "localhost").withProperty("SMTP_AUTH", "false");
        assertEquals("legacy@example.test", SmtpMailSettings.from(legacy.withProperty("MAIL_FROM", "legacy@example.test")).fromAddress());
    }

    @Test
    void disabledMailNeedsNoProviderOrCredentialsAndAllPortsRemainUnavailable() {
        var disabled = new MockEnvironment().withProperty("MAIL_PROVIDER", "unknown");
        assertNull(SmtpMailSettings.from(disabled).sender());
        assertFalse(new SmtpVerificationMailAdapter(disabled).available());
        assertFalse(new SmtpContactMailAdapter(disabled).available());
        assertFalse(new SmtpProjectInvitationMailAdapter(disabled).available());
        assertDoesNotThrow(() -> new ProductionMailConfigurationValidator(disabled.withProperty("APP_ENV", "prod")));
    }

    @Test
    void missingProductionCredentialsFailWithoutLeakingValues() {
        var env = enabled().withProperty("APP_ENV", "prod").withProperty("SMTP_AUTH", "true")
                .withProperty("SMTP_USERNAME", "provider-login@example.test");
        assertEquals("SMTP_PASSWORD is required when mail is enabled",
                assertThrows(IllegalStateException.class, () -> new ProductionMailConfigurationValidator(env)).getMessage());
        assertThrows(IllegalStateException.class, () -> SmtpMailSettings.from(enabled()
                .withProperty("APP_ENV", "prod").withProperty("SMTP_STARTTLS", "false")));
    }

    @Test
    void invalidSenderProviderAndPortAreRejected() {
        for (String address : new String[] {"", "bad", "a@b.co\r\nBcc: x@y.co", "a@b.co, x@y.co", "Name <a@b.co>"}) {
            assertThrows(IllegalStateException.class, () -> SmtpMailSettings.from(enabled().withProperty("SMTP_FROM_ADDRESS", address)));
        }
        assertThrows(IllegalStateException.class, () -> SmtpMailSettings.from(enabled().withProperty("MAIL_PROVIDER", "unknown")));
        assertThrows(IllegalStateException.class, () -> SmtpMailSettings.from(enabled().withProperty("SMTP_PORT", "65536")));
    }

    @Test
    void smtpAndBrevoRelayAuthenticateAndDeliverAllThreeMailFlows() throws Exception {
        for (String provider : new String[] {"smtp", "brevo"}) {
            GreenMail server = new GreenMail(ServerSetupTest.SMTP.dynamicPort());
            try {
                server.setUser("recipient@example.test", "relay-login", "test-only-password");
                server.start();
                var env = enabled().withProperty("MAIL_PROVIDER", provider)
                        .withProperty("SMTP_PORT", Integer.toString(server.getSmtp().getPort()))
                        .withProperty("SMTP_STARTTLS", "false").withProperty("SMTP_AUTH", "true")
                        .withProperty("SMTP_USERNAME", "relay-login").withProperty("SMTP_PASSWORD", "test-only-password")
                        .withProperty("pda.contact.recipient", "recipient@example.test");
                var verification = new SmtpVerificationMailAdapter(env);
                verification.sendVerificationCode("recipient@example.test", "123456", MailLocale.TR);
                verification.sendPasswordResetCode("recipient@example.test", "123456", MailLocale.EN);
                verification.sendPasswordChangeCode("recipient@example.test", "123456", MailLocale.DE);
                verification.sendAccountDeletionLink("recipient@example.test", "https://example.test/delete", MailLocale.TR);
                new SmtpProjectInvitationMailAdapter(env).sendInvitation("recipient@example.test", "Project", "https://example.test/invite");
                new SmtpContactMailAdapter(env).send(ContactMessage.validated("Ece", null, "visitor@example.test", "Test-only contact message."));
                assertTrue(server.waitForIncomingEmail(5000, 6));
                var messages = server.getReceivedMessages();
                assertEquals(6, messages.length);
                for (int i = 0; i < messages.length; i++) {
                    var from = (InternetAddress) messages[i].getFrom()[0];
                    assertEquals("info@pd-assistant.com", from.getAddress());
                    assertEquals(SmtpMailSettings.SENDER_NAME, from.getPersonal());
                    assertEquals("recipient@example.test", ((InternetAddress) messages[i].getRecipients(Message.RecipientType.TO)[0]).getAddress());
                    assertEquals(i == 5 ? "visitor@example.test" : "info@pd-assistant.com",
                            ((InternetAddress) messages[i].getReplyTo()[0]).getAddress());
                }
                assertTrue(messages[0].isMimeType("multipart/*"));
            } finally {
                server.stop();
            }
        }
    }
}
