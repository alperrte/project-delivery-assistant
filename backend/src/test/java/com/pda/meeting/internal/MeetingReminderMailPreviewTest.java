package com.pda.meeting.internal;

import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import java.nio.file.*;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Writes a local web preview of the reminder mail to {@code target/email-preview/index.html} so the design can be reviewed in a browser.
 * The preview is generated from the very same {@code SmtpMeetingReminderMail.render} that is sent (there is no second copy of the
 * design), uses only neutral sample text, and exists only in the build output: no endpoint, nothing is served by the application.
 * Dark mode is shown by switching the template's own {@code prefers-color-scheme} block on for the dark frames.
 */
class MeetingReminderMailPreviewTest {
    @Test void writesPreviewOfEveryLanguageInLightAndDarkFromTheRealTemplate() throws Exception {
        Path out=Path.of("target","email-preview"); Files.createDirectories(out);
        try(var logo=getClass().getResourceAsStream("/branding/pda-logo.png")) { assertNotNull(logo,"the real PDA logo must be packaged"); Files.copy(logo,out.resolve("pda-logo.png"),StandardCopyOption.REPLACE_EXISTING); }
        for(String language:new String[]{"tr","en","de"}) {
            var recipient=new UserAccounts.MailRecipient("preview@example.test",switch(language){case "en"->"Sample User";case "de"->"Beispielperson";default->"Örnek Kullanıcı";},language);
            var envelope=new MeetingReminderStore.Envelope(UUID.fromString("00000000-0000-0000-0000-000000000001"),"ornek-proje",
                switch(language){case "en"->"Sprint planning";case "de"->"Sprint-Planung";default->"Sprint planlama toplantısı";},
                Instant.parse("2026-11-12T11:00:00Z"),"Europe/Istanbul",switch(language){case "en"->"Sample Organizer";case "de"->"Beispiel-Organisation";default->"Örnek Düzenleyen";},recipient);
            var mail=SmtpMeetingReminderMail.render("https://pda.example.test",envelope);
            String html=mail.html().replace("cid:"+SmtpMeetingReminderMail.LOGO_CID,"pda-logo.png");
            Files.writeString(out.resolve(language+".html"),html);
            Files.writeString(out.resolve(language+"-dark.html"),html.replace("@media (prefers-color-scheme: dark)","@media all"));
            Files.writeString(out.resolve(language+".txt"),"Subject: "+mail.subject()+"\n\n"+mail.text());
        }
        Files.writeString(out.resolve("index.html"),"""
            <!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDA e-posta önizlemesi</title>
            <style>body{margin:0;font-family:Arial,sans-serif;background:#e2e8f0;color:#0f172a}header{padding:16px 24px;background:#0f172a;color:#fff;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
            header a{color:#bfdbfe;margin-right:12px}h1{font-size:18px;margin:0 16px 0 0}main{display:flex;gap:24px;padding:24px;flex-wrap:wrap;align-items:flex-start}
            figure{margin:0}figcaption{font-weight:700;margin:0 0 8px}iframe{border:1px solid #94a3b8;background:#fff;border-radius:8px}.d{width:680px;height:880px}.m{width:375px;height:880px}</style></head>
            <body><header><h1>PDA toplantı hatırlatma e-postası (yerel önizleme)</h1><span>Dil:</span><a href="?lang=tr">TR</a><a href="?lang=en">EN</a><a href="?lang=de">DE</a>
            <span style="opacity:.7">Bu sayfa gerçek e-posta şablonundan üretilir; sunucuda yayınlanmaz.</span></header>
            <main id="frames"></main><script>
            const lang=new URLSearchParams(location.search).get('lang')||'tr';
            const frames=[['Masaüstü — açık','d',lang+'.html'],['Mobil — açık','m',lang+'.html'],['Masaüstü — koyu istemci','d',lang+'-dark.html'],['Mobil — koyu istemci','m',lang+'-dark.html']];
            document.getElementById('frames').innerHTML=frames.map(f=>`<figure><figcaption>${f[0]}</figcaption><iframe class="${f[1]}" src="${f[2]}" title="${f[0]}"></iframe></figure>`).join('');
            </script></body></html>""");
        assertTrue(Files.size(out.resolve("tr.html"))>1000);
    }
}
