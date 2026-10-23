package com.pda.meeting.internal;

import com.pda.shared.SmtpMailSettings;
import jakarta.mail.MessagingException;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailParseException;
import org.springframework.mail.MailSendException;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import java.io.IOException;
import java.net.URI;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * The one-hour meeting reminder. The layout is a plain table (so Outlook and Gmail render it), every style is inline, a small dark-mode
 * block upgrades it where the client supports {@code prefers-color-scheme}, and the real PDA logo travels inside the message as the
 * {@code pda-logo} inline image (the same file and Content-ID the account mails use), with its alt text as the fallback.
 */
@Component
public class SmtpMeetingReminderMail implements MeetingReminderMail {
    /** Content-ID of the inline logo; the HTML refers to it as {@code cid:pda-logo}. */
    static final String LOGO_CID = "pda-logo";
    private static final String LOGO_RESOURCE = "branding/pda-logo.png";
    private static volatile byte[] logoBytes;
    private final SmtpMailSettings smtp;
    private final String origin;
    public SmtpMeetingReminderMail(Environment environment) {
        smtp=SmtpMailSettings.from(environment);
        URI base=URI.create(environment.getRequiredProperty("FRONTEND_URL"));
        if(!java.util.Set.of("http","https").contains(base.getScheme())||base.getHost()==null
                ||base.getRawUserInfo()!=null||base.getRawQuery()!=null||base.getRawFragment()!=null
                ||!(base.getPath().isEmpty()||base.getPath().equals("/"))) throw new IllegalStateException("FRONTEND_URL must be a trusted origin");
        origin=base.toString().replaceAll("/+$","");
    }
    @Override public boolean available() { return smtp.sender()!=null; }
    @Override public void send(MeetingReminderStore.Envelope reminder) {
        if(!available()) throw new MailSendException("Mail disabled");
        var rendered=render(origin,reminder);
        try {
            var message=smtp.sender().createMimeMessage();
            var helper=new org.springframework.mail.javamail.MimeMessageHelper(message,true,"UTF-8");
            helper.setFrom(SmtpMailSettings.namedAddress(smtp.fromAddress()));
            helper.setReplyTo(smtp.fromAddress());
            helper.setTo(reminder.recipient().email());
            helper.setSubject(rendered.subject());
            helper.setText(rendered.text(),rendered.html());
            byte[] logo=logo();
            if(logo!=null) helper.addInline(LOGO_CID,new ByteArrayResource(logo),"image/png");
            smtp.sender().send(message);
        } catch(MessagingException invalid) { throw new MailParseException("Invalid reminder message"); }
    }
    /** The logo bytes, or null when the file is not packaged (the message is then sent with the alt text instead of failing). */
    private static byte[] logo() {
        byte[] cached=logoBytes;
        if(cached==null) {
            try(var stream=new ClassPathResource(LOGO_RESOURCE).getInputStream()) { cached=stream.readAllBytes(); logoBytes=cached; }
            catch(IOException missing) { return null; }
        }
        return cached;
    }
    static Rendered render(String origin,MeetingReminderStore.Envelope r) {
        String language=java.util.Set.of("tr","en","de").contains(r.recipient().locale())?r.recipient().locale():"tr";
        Copy c=copy(language);
        String project=org.springframework.web.util.UriUtils.encodePathSegment(r.projectSlug(),java.nio.charset.StandardCharsets.UTF_8);
        String link=origin+switch(language) {
            case "en" -> "/en/projects/"+project+"/meetings/";
            case "de" -> "/de/projekte/"+project+"/besprechungen/";
            default -> "/tr/projeler/"+project+"/toplantilar/";
        }+r.meetingId();
        var local=r.startsAt().atZone(ZoneId.of(r.zoneId()));
        String date=DateTimeFormatter.ofPattern("d MMMM uuuu",Locale.forLanguageTag(language)).format(local);
        String time=DateTimeFormatter.ofPattern("HH:mm XXX").format(local);
        String name=line(r.recipient().nickname()==null?"":r.recipient().nickname()).strip();
        String greeting=name.isEmpty()?c.greeting():c.greeting()+" "+name+",";
        String title=line(r.title());
        String[] labels={c.date(),c.time(),c.zone(),c.organizer()};
        String[] values={date,time,line(r.zoneId()),line(r.organizer())};

        StringBuilder text=new StringBuilder(greeting+"\n\n"+c.heading()+"\n"+c.intro()+"\n\n"+c.meeting()+": "+title+"\n");
        StringBuilder rows=new StringBuilder();
        for(int i=0;i<labels.length;i++) {
            text.append(labels[i]).append(": ").append(values[i]).append('\n');
            rows.append("<tr><td class=\"muted\" style=\"padding:6px 12px 6px 0;font-size:13px;line-height:20px;color:#64748b;white-space:nowrap;vertical-align:top\">")
                .append(html(labels[i])).append("</td><td class=\"ink\" style=\"padding:6px 0;font-size:15px;line-height:22px;font-weight:600;color:#0f172a;overflow-wrap:anywhere\">")
                .append(html(values[i])).append("</td></tr>");
        }
        text.append('\n').append(c.action()).append(": ").append(link).append("\n\n").append(c.closing()).append("\n").append(c.team()).append("\n");

        String body="<!doctype html><html lang=\""+language+"\" xmlns=\"http://www.w3.org/1999/xhtml\"><head><meta charset=\"utf-8\">"
            +"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light dark\"><meta name=\"supported-color-schemes\" content=\"light dark\">"
            +"<title>"+html(c.heading())+"</title><style>"
            +"@media (prefers-color-scheme: dark){.page{background:#0b1020!important}.card{background:#141a2b!important}.band{background:#0f1b36!important;border-color:#3b82f6!important}"
            +".ink{color:#f1f5f9!important}.muted{color:#9aa7bd!important}.panel{background:#0e1424!important;border-color:#27314a!important}.foot{background:#0e1424!important}.divider{border-color:#27314a!important}}"
            +"@media (max-width:620px){.wrap{padding:12px 8px!important}.pad{padding:22px 20px!important}.button a{display:block!important}}"
            +"</style></head><body class=\"page\" style=\"margin:0;padding:0;background:#f1f5f9\">"
            +"<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent\">"+html(c.heading()+" — "+title)+"</div>"
            +"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" class=\"page\" bgcolor=\"#f1f5f9\" style=\"background:#f1f5f9\"><tr><td class=\"wrap\" align=\"center\" style=\"padding:28px 12px\">"
            +"<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" class=\"card\" bgcolor=\"#ffffff\" style=\"max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f172a\">"
            // The logo is transparent with dark lettering, so it sits on a light band (as in the account mails).
            +"<tr><td class=\"band\" align=\"center\" bgcolor=\"#eaf2ff\" style=\"background:#eaf2ff;border-bottom:3px solid #2563eb;padding:18px 20px 12px\">"
            +"<img src=\"cid:"+LOGO_CID+"\" width=\"150\" alt=\"PDA — Project Delivery Assistant\" style=\"display:block;border:0;margin:0 auto;width:150px;max-width:100%;height:auto;font-size:16px;font-weight:bold;color:#0f172a\"></td></tr>"
            +"<tr><td class=\"pad\" style=\"padding:30px 32px 8px\">"
            +"<p class=\"muted\" style=\"margin:0 0 6px;font-size:12px;line-height:18px;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;color:#2563eb\">"+html(c.kicker())+"</p>"
            +"<h1 class=\"ink\" style=\"margin:0 0 14px;font-size:26px;line-height:32px;font-weight:700;color:#0f172a\">"+html(c.heading())+"</h1>"
            +"<p class=\"ink\" style=\"margin:0 0 8px;font-size:16px;line-height:24px;color:#0f172a\">"+html(greeting)+"</p>"
            +"<p class=\"muted\" style=\"margin:0;font-size:15px;line-height:24px;color:#475569\">"+html(c.intro())+"</p></td></tr>"
            +"<tr><td class=\"pad\" style=\"padding:20px 32px 6px\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" class=\"panel\" bgcolor=\"#f8fafc\" style=\"background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px\">"
            +"<tr><td style=\"padding:18px 20px 8px\"><p class=\"muted\" style=\"margin:0 0 4px;font-size:12px;line-height:18px;color:#64748b\">"+html(c.meeting())+"</p>"
            +"<p class=\"ink\" style=\"margin:0;font-size:19px;line-height:26px;font-weight:700;color:#0f172a;overflow-wrap:anywhere\">"+html(title)+"</p></td></tr>"
            +"<tr><td style=\"padding:4px 20px 14px\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\">"+rows+"</table></td></tr></table></td></tr>"
            // Bulletproof button: the colour lives on the cell, so clients that drop link styles still show a filled button.
            +"<tr><td class=\"pad\" align=\"center\" style=\"padding:22px 32px 8px\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" class=\"button\"><tr>"
            +"<td align=\"center\" bgcolor=\"#2563eb\" style=\"border-radius:10px;background:#2563eb\"><a href=\""+html(link)+"\" style=\"display:inline-block;padding:14px 34px;font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px\">"+html(c.action())+"</a></td></tr></table></td></tr>"
            +"<tr><td class=\"pad\" style=\"padding:6px 32px 22px\" align=\"center\"><p class=\"muted\" style=\"margin:0;font-size:12px;line-height:18px;color:#64748b;overflow-wrap:anywhere\">"+html(c.fallback())+" <a href=\""+html(link)+"\" style=\"color:#2563eb\">"+html(link)+"</a></p></td></tr>"
            +"<tr><td class=\"pad\" style=\"padding:0 32px 26px\"><div class=\"divider\" style=\"border-top:1px solid #e2e8f0;padding-top:18px\"><p class=\"muted\" style=\"margin:0 0 4px;font-size:14px;line-height:22px;color:#475569\">"+html(c.closing())+"</p>"
            +"<p class=\"ink\" style=\"margin:0;font-size:14px;line-height:22px;font-weight:700;color:#0f172a\">"+html(c.team())+"</p></div></td></tr>"
            +"<tr><td class=\"foot\" align=\"center\" bgcolor=\"#f8fafc\" style=\"background:#f8fafc;padding:14px 20px\"><p class=\"muted\" style=\"margin:0;font-size:12px;line-height:18px;color:#64748b\">PDA — Project Delivery Assistant</p></td></tr>"
            +"</table></td></tr></table></body></html>";
        return new Rendered("[PDA] "+c.heading()+" — "+title,text.toString(),body,link);
    }
    private static Copy copy(String language) {
        return switch(language) {
            case "en" -> new Copy("Meeting reminder","Your meeting starts in 1 hour","Hello","Your meeting is about to begin. Open it from the button below when you are ready to join.",
                "Meeting","Date","Time","Time zone","Organizer","View meeting","If the button does not work, copy this link:","Have a productive meeting.","The PDA Team");
            case "de" -> new Copy("Meeting-Erinnerung","Ihr Meeting beginnt in 1 Stunde","Hallo","Ihr Meeting beginnt in Kürze. Öffnen Sie es über die Schaltfläche, sobald Sie teilnehmen möchten.",
                "Meeting","Datum","Uhrzeit","Zeitzone","Organisator","Meeting ansehen","Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link:","Wir wünschen Ihnen ein produktives Meeting.","Ihr PDA-Team");
            default -> new Copy("Toplantı hatırlatması","Toplantınız 1 saat sonra başlıyor","Merhaba","Katılacağınız toplantı birazdan başlıyor. Hazır olduğunuzda aşağıdaki düğmeyle toplantıya gidebilirsiniz.",
                "Toplantı","Tarih","Saat","Saat dilimi","Düzenleyen","Toplantıyı görüntüle","Düğme çalışmazsa bu bağlantıyı kopyalayın:","Verimli bir toplantı dileriz.","PDA Ekibi");
        };
    }
    private static String html(String value) { return HtmlUtils.htmlEscape(value); }
    private static String line(String value) {
        return value.codePoints().collect(StringBuilder::new,(b,cp)->b.appendCodePoint(Character.isISOControl(cp)||cp==0x2028||cp==0x2029?' ':cp),StringBuilder::append).toString();
    }
    record Rendered(String subject,String text,String html,String link) {}
    private record Copy(String kicker,String heading,String greeting,String intro,String meeting,String date,String time,String zone,String organizer,
                        String action,String fallback,String closing,String team) {}
}
