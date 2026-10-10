package com.pda.auth.infrastructure.mail;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.auth.application.service.MailLocale;
import com.pda.auth.infrastructure.mail.VerificationMailTemplate.Kind;
import org.junit.jupiter.api.Test;

class VerificationMailTemplateTest {

    @Test
    void everyKindAndLanguageCarriesTheSecretInTextAndHtmlWithTheLogoAndFooter() {
        for (Kind kind : Kind.values()) {
            for (MailLocale locale : MailLocale.values()) {
                String secret = kind == Kind.ACCOUNT_DELETION ? "https://pda.example/hesap-sil?token=abc" : "123456";
                var mail = VerificationMailTemplate.render(kind, locale, secret);

                assertTrue(mail.text().contains(secret), kind + "/" + locale + " text");
                assertTrue(mail.html().contains(secret), kind + "/" + locale + " html");
                assertTrue(mail.html().contains("cid:" + VerificationMailTemplate.LOGO_CID), kind + "/" + locale + " logo");
                assertTrue(mail.html().contains("15"), kind + "/" + locale + " validity");
                assertTrue(mail.text().contains("PDA"), kind + "/" + locale + " footer");
                assertFalse(mail.subject().isBlank());
            }
        }
    }

    @Test
    void registrationMailSaysTheCodeExpiresAndTheRegistrationIsCancelled() {
        var tr = VerificationMailTemplate.render(Kind.REGISTER, MailLocale.TR, "654321");
        assertTrue(tr.text().contains("Merhaba"));
        assertTrue(tr.text().contains("15 dakika geçerlidir"));
        assertTrue(tr.text().contains("kaydınız iptal edilir"));
        // The closing message sits above the signature, and "Hoş geldiniz" is said once, at the top.
        assertTrue(tr.text().contains("teslim etmeniz dileğiyle.\nPDA Ekibi"));
        assertFalse(tr.text().contains("Hoş geldiniz —"));

        var en = VerificationMailTemplate.render(Kind.REGISTER, MailLocale.EN, "654321");
        assertTrue(en.text().contains("Hello"));
        assertTrue(en.text().contains("15 minutes"));
        assertTrue(en.text().contains("cancelled"));

        var de = VerificationMailTemplate.render(Kind.REGISTER, MailLocale.DE, "654321");
        assertTrue(de.text().contains("Hallo"));
        assertTrue(de.text().contains("15 Minuten"));
    }

    @Test
    void otherMailsEndWithThePdaTeam() {
        assertTrue(VerificationMailTemplate.render(Kind.PASSWORD_RESET, MailLocale.TR, "111111").text().contains("PDA ekibi"));
        assertTrue(VerificationMailTemplate.render(Kind.PASSWORD_CHANGE, MailLocale.EN, "111111").text().contains("The PDA team"));
        assertTrue(VerificationMailTemplate.render(Kind.PASSWORD_RESET, MailLocale.DE, "111111").text().contains("Ihr PDA-Team"));
    }

    @Test
    void deletionMailAsksForConfirmationAndOffersAButton() {
        var mail = VerificationMailTemplate.render(Kind.ACCOUNT_DELETION, MailLocale.TR, "https://pda.example/x?token=t");
        assertTrue(mail.text().contains("Hesabınızı gerçekten silmek istediğinize emin misiniz?"));
        assertTrue(mail.html().contains("<a href=\"https://pda.example/x?token=t\""));
        assertTrue(mail.html().contains("Hesabımı silmeyi onayla"));
    }

    @Test
    void htmlEscapesTheSecret() {
        var mail = VerificationMailTemplate.render(Kind.ACCOUNT_DELETION, MailLocale.EN, "https://x/?a=1&b=<2>");
        assertFalse(mail.html().contains("<2>"));
        assertTrue(mail.html().contains("&amp;b=&lt;2&gt;"));
        assertEquals("https://x/?a=1&b=<2>", mail.text().lines().filter(line -> line.startsWith("https://")).findFirst().orElseThrow());
    }

    @Test
    void localeFallsBackToTurkish() {
        assertEquals(MailLocale.TR, MailLocale.from(null));
        assertEquals(MailLocale.TR, MailLocale.from("fr"));
        assertEquals(MailLocale.DE, MailLocale.from("de"));
        assertEquals(MailLocale.EN, MailLocale.from("EN"));
    }
}
