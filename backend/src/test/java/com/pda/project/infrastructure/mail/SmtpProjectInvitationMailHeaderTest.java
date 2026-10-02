package com.pda.project.infrastructure.mail;

import com.pda.user.ProjectRole;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.Test;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Project and team names are typed by users and end up in the invitation mail's Subject. A name that carries CR/LF
 * must not be able to add headers (a Bcc to a stranger, a second Subject, a forged body) to the message that is sent.
 * The test renders the real MIME message, exactly as the SMTP transport would write it.
 */
class SmtpProjectInvitationMailHeaderTest {

    private static final String HOSTILE = "Quarterly plan\r\nBcc: attacker@example.test\r\nX-Injected: yes\r\n\r\nFake body";

    private static byte[] render(SimpleMailMessage simple) throws Exception {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        MimeMessage mime = sender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(mime, StandardCharsets.UTF_8.name());
        helper.setFrom(simple.getFrom());
        helper.setTo(simple.getTo());
        helper.setSubject(simple.getSubject());
        helper.setText(simple.getText());
        mime.saveChanges();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        mime.writeTo(out);
        return out.toByteArray();
    }

    @Test
    void aProjectNameWithLineBreaksCannotAddHeadersOrForgeTheBody() throws Exception {
        SimpleMailMessage message = SmtpProjectInvitationMailAdapter.compose("noreply@example.test", "friend@example.test",
                HOSTILE, "Team\r\nBcc: x@example.test", "inviter", Set.of(ProjectRole.TESTER),
                "hello\r\nBcc: y@example.test", Instant.parse("2026-12-01T00:00:00Z"), "https://app.example.test/i/1");

        // Read the rendered message back the way a mail client would.
        MimeMessage parsed = new MimeMessage(Session.getInstance(new java.util.Properties()),
                new java.io.ByteArrayInputStream(render(message)));

        assertNull(message.getBcc());
        assertNull(parsed.getHeader("Bcc"));
        assertNull(parsed.getHeader("X-Injected"));
        assertEquals(1, parsed.getHeader("Subject").length);
        // The subject a client shows is one clean line (long ones may be folded by the transport, never broken by the name).
        assertEquals(message.getSubject(), parsed.getSubject());
        assertTrue(message.getSubject().startsWith("You're invited to join Quarterly plan Bcc: attacker@example.test"),
                message.getSubject());
        assertFalse(message.getSubject().matches("(?s).*[\\r\\n].*"));
        // The body keeps every user text on a single line, never a made-up extra line.
        assertFalse(message.getText().contains("\r"));
        assertFalse(message.getText().lines().anyMatch(line -> line.startsWith("Bcc:")));
    }

    @Test
    void singleLineReplacesEveryKindOfLineBreakAndKeepsOrdinaryText() {
        assertEquals("a b c d e", SmtpProjectInvitationMailAdapter.singleLine("a\nb\rc d\u0085e"));
        assertEquals("Öğrenci İşleri 日本語", SmtpProjectInvitationMailAdapter.singleLine("  Öğrenci   İşleri\t日本語 "));
        assertEquals("", SmtpProjectInvitationMailAdapter.singleLine(null));
    }
}
