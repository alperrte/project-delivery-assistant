package com.pda.contact.infrastructure.mail;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.contact.application.service.ContactMessage;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Collections;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The header rules of the contact mail, checked without a mail server. */
class SmtpContactMailAdapterTest {

    private static final ContactMessage MESSAGE =
            ContactMessage.validated("Ece", "Yıldız", "ece@example.com", "Merhaba,\nuygulama hakkında bir sorum var.");

    private static MimeMessage compose(ContactMessage message) throws Exception {
        MimeMessage mime = new MimeMessage(Session.getInstance(new Properties()));
        SmtpContactMailAdapter.compose(mime, "pda-noreply@example.test", "pdassistant@gmail.com", message);
        mime.saveChanges();
        return mime;
    }

    @Test
    void fromIsThePdaSenderToIsTheFixedRecipientAndReplyToIsTheVisitor() throws Exception {
        MimeMessage mime = compose(MESSAGE);
        assertArrayEquals(new InternetAddress[] {new InternetAddress("pda-noreply@example.test")}, mime.getFrom());
        assertArrayEquals(new InternetAddress[] {new InternetAddress("pdassistant@gmail.com")},
                mime.getRecipients(Message.RecipientType.TO));
        assertArrayEquals(new InternetAddress[] {new InternetAddress("ece@example.com")}, mime.getReplyTo());
        assertNull(mime.getRecipients(Message.RecipientType.CC));
        assertNull(mime.getRecipients(Message.RecipientType.BCC));
        assertEquals("Yeni PDA İletişim Talebi", mime.getSubject());
    }

    @Test
    void theBodyIsReadablePlainText() throws Exception {
        String body = SmtpContactMailAdapter.body(MESSAGE);
        assertEquals("Yeni PDA İletişim Talebi\n\nAd Soyad:\nEce Yıldız\n\nE-posta:\nece@example.com\n\n"
                + "Mesaj:\nMerhaba,\nuygulama hakkında bir sorum var.\n", body);
        assertTrue(compose(MESSAGE).getContentType().startsWith("text/plain"));
    }

    @Test
    void aLineBreakInAValueThatReachedTheAdapterCannotAddAHeaderOrALine() throws Exception {
        // ContactMessage rejects these first; the adapter must stay safe even if one slipped through (defence in depth).
        ContactMessage hostile = new ContactMessage("Eve\r\nBcc: victim@example.com", "Evil\nCc: x@y.co",
                "ece@example.com", "Merhaba, bir sorum var.");
        String body = SmtpContactMailAdapter.body(hostile);
        assertTrue(body.contains("Ad Soyad:\nEve Bcc: victim@example.com Evil Cc: x@y.co\n"), body);
        assertEquals(1, body.lines().filter(line -> line.startsWith("Ad Soyad")).count());
        MimeMessage mime = compose(hostile);
        assertNull(mime.getHeader("Bcc"));
        assertNull(mime.getHeader("Cc"));
        assertEquals(1, Collections.list(mime.getAllHeaderLines()).stream().filter(line -> line.startsWith("To:")).count());
    }

    @Test
    void aHostileReplyToAddressIsRefused() {
        for (String address : new String[] {"a@b.co\r\nBcc: x@y.co", "a@b.co, c@d.co", "Name <a@b.co>", "a@b.co;c@d.co"}) {
            ContactMessage hostile = new ContactMessage("E", "Y", address, "Merhaba, bir sorum var.");
            assertThrows(IllegalStateException.class, () -> compose(hostile), address);
        }
    }

    @Test
    void singleLineTurnsControlCharactersIntoSpaces() {
        assertEquals("a b c d", SmtpContactMailAdapter.singleLine("a\r\nb c\u0000d"));
        assertEquals("", SmtpContactMailAdapter.singleLine(null));
    }

    @Test
    void mailThatIsSwitchedOffIsUnavailable() {
        assertFalse(new SmtpContactMailAdapter(new MockEnvironment()).available());
        assertFalse(new SmtpContactMailAdapter(new MockEnvironment().withProperty("MAIL_ENABLED", "false")).available());
    }

    @Test
    void enabledMailNeedsAHostASenderAndAValidFixedRecipient() {
        MockEnvironment valid = new MockEnvironment().withProperty("MAIL_ENABLED", "true")
                .withProperty("SMTP_HOST", "localhost").withProperty("MAIL_FROM", "pda@example.test")
                .withProperty("SMTP_AUTH", "false").withProperty("pda.contact.recipient", "pdassistant@gmail.com");
        assertTrue(new SmtpContactMailAdapter(valid).available());
        for (String recipient : new String[] {"", "not-an-address", "a@b.co, c@d.co", "Name <a@b.co>"}) {
            MockEnvironment bad = new MockEnvironment().withProperty("MAIL_ENABLED", "true")
                    .withProperty("SMTP_HOST", "localhost").withProperty("MAIL_FROM", "pda@example.test")
                    .withProperty("SMTP_AUTH", "false").withProperty("pda.contact.recipient", recipient);
            assertThrows(IllegalStateException.class, () -> new SmtpContactMailAdapter(bad), recipient);
        }
        assertThrows(IllegalStateException.class, () -> new SmtpContactMailAdapter(new MockEnvironment()
                .withProperty("MAIL_ENABLED", "true").withProperty("MAIL_FROM", "pda@example.test")
                .withProperty("pda.contact.recipient", "pdassistant@gmail.com")));
    }
}
