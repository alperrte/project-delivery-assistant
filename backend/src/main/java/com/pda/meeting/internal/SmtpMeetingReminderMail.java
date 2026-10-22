package com.pda.meeting.internal;

import com.pda.shared.SmtpMailSettings;
import jakarta.mail.MessagingException;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailParseException;
import org.springframework.mail.MailSendException;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;
import java.net.URI;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Component
public class SmtpMeetingReminderMail implements MeetingReminderMail {
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
            smtp.sender().send(message);
        } catch(MessagingException invalid) { throw new MailParseException("Invalid reminder message"); }
    }
    static Rendered render(String origin,MeetingReminderStore.Envelope r) {
        String language=java.util.Set.of("tr","en","de").contains(r.recipient().locale())?r.recipient().locale():"tr";
        Copy c=switch(language) {
            case "en" -> new Copy("Upcoming meeting","Hello,","A reminder about your upcoming meeting.","Meeting","Date","Time","Time zone","Organizer","View meeting");
            case "de" -> new Copy("Bevorstehendes Meeting","Hallo,","Wir erinnern Sie an Ihr bevorstehendes Meeting.","Meeting","Datum","Uhrzeit","Zeitzone","Organisator","Meeting ansehen");
            default -> new Copy("Yaklaşan toplantınız","Merhaba,","Yaklaşan toplantınızı hatırlatmak istiyoruz.","Toplantı","Tarih","Saat","Saat dilimi","Düzenleyen","Toplantıyı görüntüle");
        };
        String project=org.springframework.web.util.UriUtils.encodePathSegment(r.projectSlug(),java.nio.charset.StandardCharsets.UTF_8);
        String link=origin+switch(language) {
            case "en" -> "/en/projects/"+project+"/meetings/";
            case "de" -> "/de/projekte/"+project+"/besprechungen/";
            default -> "/tr/projeler/"+project+"/toplantilar/";
        }+r.meetingId();
        var local=r.startsAt().atZone(ZoneId.of(r.zoneId()));
        String date=DateTimeFormatter.ofPattern("d MMMM uuuu",Locale.forLanguageTag(language)).format(local);
        String time=DateTimeFormatter.ofPattern("HH:mm XXX").format(local);
        String[] labels={c.meeting(),c.date(),c.time(),c.zone(),c.organizer()};
        String[] values={line(r.title()),date,time,line(r.zoneId()),line(r.organizer())};
        StringBuilder text=new StringBuilder(c.greeting()+"\n\n"+c.intro()+"\n\n");
        StringBuilder details=new StringBuilder();
        for(int i=0;i<labels.length;i++) {
            text.append(labels[i]).append(": ").append(values[i]).append('\n');
            details.append("<p style=\"margin:12px 0;overflow-wrap:anywhere\"><strong>").append(html(labels[i])).append(":</strong> ").append(html(values[i])).append("</p>");
        }
        text.append('\n').append(c.action()).append(": ").append(link).append("\n\nPDA — Project Delivery Assistant");
        String body="<!doctype html><html lang=\""+language+"\"><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>"
                +"<body style=\"margin:0;background:#f4f5f7;color:#18181b;font-family:Arial,sans-serif\">"
                +"<main style=\"max-width:560px;margin:24px auto;padding:24px;background:#ffffff;border-radius:12px;line-height:1.6\">"
                +"<p style=\"font-weight:bold\">PDA</p><h1 style=\"font-size:24px\">"+html(c.heading())+"</h1><p>"+html(c.greeting())+"</p><p>"+html(c.intro())+"</p>"
                +details+"<p style=\"margin-top:24px\"><a href=\""+html(link)+"\" style=\"display:inline-block;padding:12px 18px;background:#18181b;color:#ffffff;border-radius:8px;text-decoration:none\">"+html(c.action())+"</a></p>"
                +"<p style=\"font-size:12px;color:#52525b\">PDA — Project Delivery Assistant</p></main></body></html>";
        return new Rendered("[PDA] "+c.heading()+" — "+line(r.title()),text.toString(),body,link);
    }
    private static String html(String value) { return HtmlUtils.htmlEscape(value); }
    private static String line(String value) {
        return value.codePoints().collect(StringBuilder::new,(b,cp)->b.appendCodePoint(Character.isISOControl(cp)||cp==0x2028||cp==0x2029?' ':cp),StringBuilder::append).toString();
    }
    record Rendered(String subject,String text,String html,String link) {}
    private record Copy(String heading,String greeting,String intro,String meeting,String date,String time,String zone,String organizer,String action) {}
}
