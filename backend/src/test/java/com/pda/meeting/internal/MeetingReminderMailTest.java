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
    @ParameterizedTest @CsvSource({"tr,/tr/toplantilar/","en,/en/meetings/","de,/de/besprechungen/"})
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
    @Test void brandedLayoutCarriesLogoGreetingNameButtonDarkModeAndPlainTextFallback() {
        var recipient=new UserAccounts.MailRecipient("qa@example.test","Ayşe <b>Yılmaz</b>","tr");
        var mail=SmtpMeetingReminderMail.render("https://pd-assistant.com",new MeetingReminderStore.Envelope(UUID.randomUUID(),"Sprint planlama",Instant.parse("2026-10-25T12:00:00Z"),"Europe/Istanbul","Hamza",recipient));
        String html=mail.html();
        assertTrue(html.contains("src=\"cid:pda-logo\"")); assertTrue(html.contains("alt=\"PDA")); // the real logo travels as an inline image, with alt text as the fallback
        assertTrue(html.contains("Toplantınız 1 saat sonra başlıyor")); assertTrue(html.contains("Merhaba Ayşe &lt;b&gt;Yılmaz&lt;/b&gt;,")); assertFalse(html.contains("<b>Yılmaz"));
        assertTrue(html.contains("prefers-color-scheme: dark")); assertTrue(html.contains("max-width:620px")); assertTrue(html.contains(org.springframework.web.util.HtmlUtils.htmlEscape("Toplantıyı görüntüle")));
        assertTrue(html.contains("bgcolor=\"#2563eb\"")); // filled button even where link styles are dropped
        assertTrue(mail.text().contains("Merhaba Ayşe <b>Yılmaz</b>,")); assertTrue(mail.text().contains("Toplantıyı görüntüle: "+mail.link()));
        assertTrue(mail.text().contains("PDA Ekibi")); assertFalse(html.contains("<script")); assertFalse(html.contains("javascript:"));
        for(String forbidden:new String[]{"token","secret","password"}) assertFalse(html.toLowerCase().contains(forbidden)); // nothing sensitive is ever in the body
    }
    @Test void disabledMailDoesNotNeedCredentialsAndUntrustedOriginIsRejected() {
        var mail=new SmtpMeetingReminderMail(new MockEnvironment().withProperty("FRONTEND_URL","https://pd-assistant.com"));
        assertFalse(mail.available());
        for(String origin:new String[]{"https://trusted.test@evil.test","https://trusted.test/?token=x","https://trusted.test/#secret","file:///tmp/mail","https://trusted.test/path"})
            assertThrows(IllegalStateException.class,()->new SmtpMeetingReminderMail(new MockEnvironment().withProperty("FRONTEND_URL",origin)));
    }
    private MeetingReminderStore.Envelope envelope(String language,String zone,String instant,String title) {
        return new MeetingReminderStore.Envelope(UUID.randomUUID(),title,Instant.parse(instant),zone,"QA Organizer",new UserAccounts.MailRecipient("qa@example.test","QA",language));
    }
}
