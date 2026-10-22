package com.pda.meeting.internal;

import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.mock.env.MockEnvironment;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class MeetingReminderMailTest {
    @ParameterizedTest @CsvSource({"tr,/tr/projeler/demo/toplantilar/","en,/en/projects/demo/meetings/","de,/de/projekte/demo/besprechungen/"})
    void rendersSavedLanguageAndLocalizedCanonicalDetailLink(String language,String path) {
        var mail=SmtpMeetingReminderMail.render("https://pd-assistant.com",envelope(language,"Europe/Istanbul","2026-10-25T12:00:00Z","Planning"));
        assertTrue(mail.link().startsWith("https://pd-assistant.com"+path)); assertTrue(mail.text().contains("15:00 +03:00"));
        assertTrue(mail.html().contains("lang=\""+language+"\"")); assertTrue(mail.html().contains(mail.link())); assertFalse(mail.link().contains("token"));
    }
    @ParameterizedTest @CsvSource({"2026-03-29T00:30:00Z,01:30 +01:00","2026-03-29T01:30:00Z,03:30 +02:00","2026-10-25T00:30:00Z,02:30 +02:00","2026-10-25T01:30:00Z,02:30 +01:00"})
    void daylightSavingTransitionsShowCorrectLocalTimeAndOffset(String instant,String local) {
        var mail=SmtpMeetingReminderMail.render("https://pd-assistant.com",envelope("de","Europe/Berlin",instant,"DST"));
        assertTrue(mail.text().contains(local)); assertTrue(mail.text().contains("Europe/Berlin"));
    }
    @Test void untrustedContentCannotInjectHeadersOrHtml() {
        var mail=SmtpMeetingReminderMail.render("https://pd-assistant.com",envelope("tr","Europe/Istanbul","2026-10-25T12:00:00Z","<script>alert(1)</script>\r\nBcc: injected@example.test\u2028more"));
        assertFalse(mail.subject().contains("\r")); assertFalse(mail.subject().contains("\n")); assertFalse(mail.subject().contains("\u2028"));
        assertFalse(mail.html().contains("<script>")); assertTrue(mail.html().contains("&lt;script&gt;"));
        assertTrue(mail.text().contains("<script>"));
    }
    @Test void disabledMailDoesNotNeedCredentialsAndUntrustedOriginIsRejected() {
        var mail=new SmtpMeetingReminderMail(new MockEnvironment().withProperty("FRONTEND_URL","https://pd-assistant.com"));
        assertFalse(mail.available());
        for(String origin:new String[]{"https://trusted.test@evil.test","https://trusted.test/?token=x","https://trusted.test/#secret","file:///tmp/mail","https://trusted.test/path"})
            assertThrows(IllegalStateException.class,()->new SmtpMeetingReminderMail(new MockEnvironment().withProperty("FRONTEND_URL",origin)));
    }
    private MeetingReminderStore.Envelope envelope(String language,String zone,String instant,String title) {
        return new MeetingReminderStore.Envelope(UUID.randomUUID(),"demo",title,Instant.parse(instant),zone,"QA Organizer",new UserAccounts.MailRecipient("qa@example.test","QA",language));
    }
}
