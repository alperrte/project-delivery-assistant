package com.pda.contact.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetupTest;
import com.pda.BackendApplication;
import com.pda.contact.ContactReporting;
import jakarta.mail.Message;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** The public contact form through the real application, the real SMTP code path (GreenMail) and PostgreSQL. */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class ContactApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    private static final String SENDER = "pda-sender@example.test";

    // Started here, not in an extension, because the property suppliers below need the port when the context starts.
    static final GreenMail GREEN_MAIL = new GreenMail(ServerSetupTest.SMTP.dynamicPort());
    static { GREEN_MAIL.start(); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("MAIL_ENABLED", () -> "true");
        registry.add("MAIL_FROM", () -> SENDER);
        registry.add("SMTP_HOST", () -> "127.0.0.1");
        registry.add("SMTP_PORT", () -> Integer.toString(GREEN_MAIL.getSmtp().getPort()));
        registry.add("SMTP_AUTH", () -> "false");
        registry.add("SMTP_STARTTLS", () -> "false");
        registry.add("contact.rate-limit.max-requests", () -> "9");
    }

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ContactReporting reporting;

    private static final AtomicInteger ADDRESSES = new AtomicInteger();

    private static String address() {
        return "contact-test-" + ADDRESSES.incrementAndGet();
    }

    private Cookie csrf() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private ResultActions send(String address, String json) throws Exception {
        Cookie csrf = csrf();
        return mvc.perform(post("/api/v1/contact").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .with(request -> { request.setRemoteAddr(address); return request; })
                .contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private static String form(String first, String last, String email, String message) {
        return "{\"firstName\":" + quote(first) + ",\"lastName\":" + quote(last) + ",\"email\":" + quote(email)
                + ",\"message\":" + quote(message) + "}";
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n")
                .replace("\t", "\\t") + "\"";
    }

    private int rows(String status) {
        return jdbc.queryForObject("SELECT count(*) FROM contact_requests WHERE delivery_status = ?", Integer.class, status);
    }

    @Test
    @Order(1)
    void aLoggedOutVisitorSendsAMessageThatReachesTheFixedRecipientWithReplyTo() throws Exception {
        GREEN_MAIL.purgeEmailFromAllMailboxes();
        int sentBefore = rows("SENT");

        send(address(), form("Ece", "Yıldız", "ece@example.com", "Merhaba,\nPDA hakkında bir sorum var."))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SENT"))
                .andExpect(jsonPath("$.code").doesNotExist());

        assertTrue(GREEN_MAIL.waitForIncomingEmail(5_000, 1));
        MimeMessage[] received = GREEN_MAIL.getReceivedMessages();
        assertEquals(1, received.length);
        MimeMessage mail = received[0];
        assertEquals(List.of(new InternetAddress("pdassistant@gmail.com")), List.of(mail.getRecipients(Message.RecipientType.TO)));
        assertEquals(List.of(new InternetAddress(SENDER)), List.of(mail.getFrom()));
        assertEquals(List.of(new InternetAddress("ece@example.com")), List.of(mail.getReplyTo()));
        assertNull(mail.getRecipients(Message.RecipientType.CC));
        assertNull(mail.getRecipients(Message.RecipientType.BCC));
        assertEquals("Yeni PDA İletişim Talebi", mail.getSubject());
        String body = mail.getContent().toString();
        assertTrue(body.contains("Ece Yıldız"), body);
        assertTrue(body.contains("ece@example.com"), body);
        assertTrue(body.contains("Merhaba,\r\nPDA hakkında bir sorum var.") || body.contains("Merhaba,\nPDA hakkında bir sorum var."), body);

        // One delivery record and nothing else: no name, address or message is kept.
        assertEquals(sentBefore + 1, rows("SENT"));
        assertEquals(List.of("created_at", "delivery_status", "id"), jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'contact_requests' ORDER BY column_name",
                String.class));
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM contact_requests WHERE id::text LIKE '%ece%' OR delivery_status LIKE '%ece%'", Integer.class));
    }

    @Test
    @Order(2)
    void recipientSenderAndCopiesCannotBeChosenByTheBrowser() throws Exception {
        GREEN_MAIL.purgeEmailFromAllMailboxes();
        String json = "{\"firstName\":\"Eve\",\"lastName\":\"Attacker\",\"email\":\"eve@example.com\","
                + "\"message\":\"Bu mesaj başkasına gitmemeli, sadece PDA kutusuna.\","
                + "\"to\":\"victim@example.com\",\"cc\":\"victim2@example.com\",\"bcc\":\"victim3@example.com\","
                + "\"from\":\"ceo@example.com\",\"replyTo\":\"other@example.com\",\"smtpHost\":\"evil.example\","
                + "\"recipient\":\"victim@example.com\",\"subject\":\"Hacked\"}";
        send(address(), json).andExpect(status().isOk());

        assertTrue(GREEN_MAIL.waitForIncomingEmail(5_000, 1));
        assertEquals(1, GREEN_MAIL.getReceivedMessages().length);
        MimeMessage mail = GREEN_MAIL.getReceivedMessages()[0];
        assertEquals(List.of(new InternetAddress("pdassistant@gmail.com")), List.of(mail.getRecipients(Message.RecipientType.TO)));
        assertNull(mail.getRecipients(Message.RecipientType.CC));
        assertNull(mail.getRecipients(Message.RecipientType.BCC));
        assertEquals(List.of(new InternetAddress(SENDER)), List.of(mail.getFrom()));
        assertEquals(List.of(new InternetAddress("eve@example.com")), List.of(mail.getReplyTo()));
        assertEquals("Yeni PDA İletişim Talebi", mail.getSubject());
        // The envelope: exactly one recipient was ever offered to the server.
        assertEquals(1, GREEN_MAIL.getReceivedMessages().length);
    }

    @Test
    @Order(3)
    void lineBreaksInNamesOrAddressCannotInjectHeadersAndSendNothing() throws Exception {
        GREEN_MAIL.purgeEmailFromAllMailboxes();
        int before = rows("SENT") + rows("FAILED");
        String address = address();
        send(address, form("Eve\r\nBcc: victim@example.com", "Y", "eve@example.com", "Merhaba, bir sorum var."))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CONTACT_INVALID"))
                .andExpect(jsonPath("$.invalidFields[0]").value("firstName"));
        send(address, form("E", "Y\nCc: victim@example.com", "eve@example.com", "Merhaba, bir sorum var."))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.invalidFields[0]").value("lastName"));
        send(address, form("E", "Y", "eve@example.com\r\nBcc: victim@example.com", "Merhaba, bir sorum var."))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.invalidFields[0]").value("email"));
        send(address, form("E", "Y", "eve@example.com,victim@example.com", "Merhaba, bir sorum var."))
                .andExpect(status().isBadRequest());
        // A raw CR/LF in the JSON string value (not an escape) is invalid JSON, equally refused.
        send(address, "{\"firstName\":\"E\r\nBcc: x@y.co\",\"lastName\":\"Y\",\"email\":\"e@x.co\",\"message\":\"Merhaba, bir sorum var.\"}")
                .andExpect(status().isBadRequest());

        assertEquals(0, GREEN_MAIL.getReceivedMessages().length);
        assertEquals(before, rows("SENT") + rows("FAILED"));
    }

    @Test
    @Order(4)
    void invalidEmptyShortAndOversizedInputIsRejectedOnTheServer() throws Exception {
        GREEN_MAIL.purgeEmailFromAllMailboxes();
        String address = address();
        send(address, form("Ece", "Y", "not-an-email", "Merhaba, bir sorum var."))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.invalidFields[0]").value("email"));
        send(address, form("   ", "   ", "a@b.co", "          ")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields.length()").value(3));
        send(address, form("Ece", "Y", "a@b.co", "kısa")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("message"));
        send(address, form("Ece", "Y", "a@b.co", "x".repeat(5_001))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("message"));
        send(address, "{}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.invalidFields.length()").value(4));
        send(address, "not json").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CONTACT_INVALID"));
        // Larger than the body limit: refused before parsing.
        send(address(), form("Ece", "Y", "a@b.co", "y".repeat(17_000))).andExpect(status().is(413))
                .andExpect(jsonPath("$.code").value("PAYLOAD_TOO_LARGE"));
        assertEquals(0, GREEN_MAIL.getReceivedMessages().length);
    }

    @Test
    @Order(5)
    void csrfIsEnforced() throws Exception {
        mvc.perform(post("/api/v1/contact").with(request -> { request.setRemoteAddr(address()); return request; })
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(form("Ece", "Y", "a@b.co", "Merhaba, bir sorum var.")))
                .andExpect(status().isForbidden());
        assertEquals(0, GREEN_MAIL.getReceivedMessages().length);
    }

    @Test
    @Order(6)
    void theSameMessageTwiceInAMinuteIsAConflictAndSendsOnlyOneMail() throws Exception {
        GREEN_MAIL.purgeEmailFromAllMailboxes();
        String address = address();
        String json = form("Ece", "Y", "dup@example.com", "Bu mesaj iki kez gönderilmemeli.");
        send(address, json).andExpect(status().isOk());
        send(address, json).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONTACT_DUPLICATE"));
        assertTrue(GREEN_MAIL.waitForIncomingEmail(5_000, 1));
        assertEquals(1, GREEN_MAIL.getReceivedMessages().length);
        // A different message is not a duplicate.
        send(address, form("Ece", "Y", "dup@example.com", "Bambaşka bir mesaj gönderiyorum şimdi.")).andExpect(status().isOk());
    }

    @Test
    @Order(7)
    void theEndpointIsRateLimitedPerAddress() throws Exception {
        String spam = "contact-test-spam";
        for (int i = 0; i < 9; i++) {
            send(spam, form("E", "Y", "bad", "x")).andExpect(status().isBadRequest());
        }
        send(spam, form("E", "Y", "a@b.co", "Merhaba, bir sorum var.")).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        // Another address is unaffected.
        send(address(), form("E", "Y", "bad", "x")).andExpect(status().isBadRequest());
    }

    @Test
    @Order(8)
    void whenTheMailServerIsDownTheAnswerIsAGenericFailureAndNotASuccess() throws Exception {
        int failedBefore = rows("FAILED");
        int sentBefore = rows("SENT");
        GREEN_MAIL.stop();
        String body = send(address(), form("Ece", "Y", "down@example.com", "Mail sunucusu kapalıyken gönderiyorum."))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("CONTACT_DELIVERY_FAILED"))
                .andReturn().getResponse().getContentAsString();
        // Nothing about the mail server, host, port or credentials reaches the browser.
        for (String leak : new String[] {"127.0.0.1", "smtp", "SMTP", "Connection", "refused", "MailSendException",
                "jakarta", "localhost"}) {
            assertFalse(body.contains(leak), leak + " leaked in " + body);
        }
        assertEquals(failedBefore + 1, rows("FAILED"));
        assertEquals(sentBefore, rows("SENT"));

        // Failed deliveries are not counted as requests; the same message may be retried at once (no 409).
        ContactReporting.ContactReport report = reporting.report(Instant.now().minusSeconds(3_600),
                Instant.now().plusSeconds(3_600), ZoneId.of("Europe/Istanbul"));
        assertEquals(sentBefore, report.sentTotal());
        send(address(), form("Ece", "Y", "down@example.com", "Mail sunucusu kapalıyken gönderiyorum."))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("CONTACT_DELIVERY_FAILED"));
    }
}
