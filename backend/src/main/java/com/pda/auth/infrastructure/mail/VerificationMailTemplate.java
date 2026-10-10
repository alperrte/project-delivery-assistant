package com.pda.auth.infrastructure.mail;

import com.pda.auth.application.service.MailLocale;
import org.springframework.web.util.HtmlUtils;

/**
 * Subject, plain text and HTML of the account mails, in Turkish, English and German. Layout: PDA logo on top, a
 * greeting, the code (or the confirmation button) in the middle, a validity note and a team footer. The plain text
 * part carries the same code so a client that blocks HTML (and the Mailpit based browser tests) still sees it.
 */
final class VerificationMailTemplate {

    static final String LOGO_CID = "pda-logo";

    enum Kind { REGISTER, PASSWORD_RESET, PASSWORD_CHANGE, ACCOUNT_DELETION }

    record Rendered(String subject, String text, String html) {}

    private record Copy(String subject, String intro, String validity, String ignore, String footer, String action) {}

    private VerificationMailTemplate() {}

    /** {@code secret} is the 6-digit code, or the confirmation link for {@link Kind#ACCOUNT_DELETION}. */
    static Rendered render(Kind kind, MailLocale locale, String secret) {
        Copy copy = copy(kind, locale);
        String greeting = switch (locale) {
            case TR -> "Merhaba,";
            case EN -> "Hello,";
            case DE -> "Hallo,";
        };
        boolean link = kind == Kind.ACCOUNT_DELETION;
        String text = greeting + "\n\n" + copy.intro + "\n\n" + secret + "\n\n" + copy.validity + "\n" + copy.ignore
                + "\n\n" + copy.footer + "\n";
        String middle = link
                ? "<a href=\"" + HtmlUtils.htmlEscape(secret) + "\" style=\"display:inline-block;background:#dc2626;"
                        + "color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;"
                        + "border-radius:8px\">" + HtmlUtils.htmlEscape(copy.action) + "</a>"
                : "<div style=\"display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;"
                        + "padding:14px 28px;font-family:'Courier New',monospace;font-size:34px;font-weight:700;"
                        + "letter-spacing:10px;color:#0b1b3a\">" + HtmlUtils.htmlEscape(secret) + "</div>";
        String html = "<!doctype html><html><body style=\"margin:0;padding:0;background:#f1f5f9\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#f1f5f9;"
                + "padding:24px 12px\"><tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"480\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:480px;width:100%;"
                + "background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#0f172a\">"
                // The logo has a transparent background and dark chrome lettering: it needs a light band to stand out.
                + "<tr><td align=\"center\" style=\"background:#eaf2ff;background-image:linear-gradient(180deg,#dbeafe,#f8fbff);"
                + "border-bottom:3px solid #2563eb;padding:20px 20px 14px\">"
                + "<img src=\"cid:" + LOGO_CID + "\" width=\"260\" alt=\"PDA\" "
                + "style=\"display:block;border:0;margin:0 auto;width:260px;max-width:100%;height:auto\"></td></tr>"
                + "<tr><td style=\"padding:28px 28px 8px;font-size:16px;line-height:24px\"><p style=\"margin:0 0 12px\">"
                + HtmlUtils.htmlEscape(greeting) + "</p><p style=\"margin:0\">" + HtmlUtils.htmlEscape(copy.intro) + "</p></td></tr>"
                + "<tr><td align=\"center\" style=\"padding:20px 28px\">" + middle + "</td></tr>"
                + "<tr><td style=\"padding:0 28px 24px;font-size:14px;line-height:21px;color:#475569\"><p style=\"margin:0 0 8px\">"
                + HtmlUtils.htmlEscape(copy.validity) + "</p><p style=\"margin:0\">" + HtmlUtils.htmlEscape(copy.ignore) + "</p>"
                + (link ? "<p style=\"margin:12px 0 0;word-break:break-all;font-size:12px\">" + HtmlUtils.htmlEscape(secret) + "</p>" : "")
                + "</td></tr>"
                + "<tr><td align=\"center\" style=\"background:#f8fafc;padding:16px 20px;font-size:14px;line-height:21px;"
                + "color:#0b1b3a\">" + footerHtml(copy.footer) + "</td></tr></table></td></tr></table></body></html>";
        return new Rendered(copy.subject, text, html);
    }

    /** A footer may carry a closing message above the signature: every line but the last is plain, the last is bold. */
    private static String footerHtml(String footer) {
        String[] lines = footer.split("\n");
        StringBuilder html = new StringBuilder();
        for (int i = 0; i < lines.length; i++) {
            boolean signature = i == lines.length - 1;
            html.append("<div style=\"").append(signature ? "font-weight:700;margin-top:4px" : "color:#475569")
                    .append("\">").append(HtmlUtils.htmlEscape(lines[i])).append("</div>");
        }
        return html.toString();
    }

    private static Copy copy(Kind kind, MailLocale locale) {
        return switch (locale) {
            case TR -> switch (kind) {
                case REGISTER -> new Copy("PDA e-posta doğrulama kodunuz",
                        "PDA'ya hoş geldiniz! Kaydınızı tamamlamak için aşağıdaki kodu girin.",
                        "Bu kod 15 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Bu süre içinde kullanılmazsa kaydınız iptal edilir.",
                        "Kaydı siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.",
                        "Projelerinizi birlikte, zamanında ve sorunsuz teslim etmeniz dileğiyle.\nPDA Ekibi", null);
                case PASSWORD_RESET -> new Copy("PDA şifre sıfırlama kodunuz",
                        "Şifrenizi sıfırlamak için aşağıdaki kodu girin.",
                        "Bu kod 15 dakika geçerlidir ve yalnızca bir kez kullanılabilir.",
                        "Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.",
                        "PDA ekibi", null);
                case PASSWORD_CHANGE -> new Copy("PDA şifre değiştirme kodunuz",
                        "Hesap ayarlarında şifrenizi değiştirmek için aşağıdaki kodu girin.",
                        "Bu kod 15 dakika geçerlidir ve yalnızca bir kez kullanılabilir.",
                        "Bu isteği siz yapmadıysanız bu e-postayı yok sayın ve şifrenizi değiştirmeyi düşünün.",
                        "PDA ekibi", null);
                case ACCOUNT_DELETION -> new Copy("PDA hesabınızı silmeyi onaylayın",
                        "Hesabınızı gerçekten silmek istediğinize emin misiniz? Silinen hesap geri getirilemez.",
                        "Bağlantı 15 dakika geçerlidir ve yalnızca bir kez kullanılabilir.",
                        "Bu isteği siz yapmadıysanız bu e-postayı yok sayın; hesabınız silinmez.",
                        "PDA ekibi", "Hesabımı silmeyi onayla");
            };
            case EN -> switch (kind) {
                case REGISTER -> new Copy("Your PDA verification code",
                        "Welcome to PDA! Enter the code below to finish your registration.",
                        "This code is valid for 15 minutes and can be used only once. If it is not used in that time, your registration is cancelled.",
                        "If you did not start this registration, you can ignore this email.",
                        "Wishing you smooth, on-time delivery of your projects.\nThe PDA Team", null);
                case PASSWORD_RESET -> new Copy("Your PDA password reset code",
                        "Enter the code below to reset your password.",
                        "This code is valid for 15 minutes and can be used only once.",
                        "If you did not request this, you can ignore this email; your password stays the same.",
                        "The PDA team", null);
                case PASSWORD_CHANGE -> new Copy("Your PDA password change code",
                        "Enter the code below to change your password in your account settings.",
                        "This code is valid for 15 minutes and can be used only once.",
                        "If you did not request this, ignore this email and consider changing your password.",
                        "The PDA team", null);
                case ACCOUNT_DELETION -> new Copy("Confirm the deletion of your PDA account",
                        "Are you sure you really want to delete your account? A deleted account cannot be restored.",
                        "The link is valid for 15 minutes and can be used only once.",
                        "If you did not request this, ignore this email; your account will not be deleted.",
                        "The PDA team", "Confirm account deletion");
            };
            case DE -> switch (kind) {
                case REGISTER -> new Copy("Ihr PDA-Bestätigungscode",
                        "Willkommen bei PDA! Geben Sie den folgenden Code ein, um Ihre Registrierung abzuschließen.",
                        "Dieser Code ist 15 Minuten gültig und kann nur einmal verwendet werden. Wird er in dieser Zeit nicht verwendet, wird Ihre Registrierung abgebrochen.",
                        "Wenn Sie die Registrierung nicht gestartet haben, können Sie diese E-Mail ignorieren.",
                        "Wir wünschen Ihnen eine reibungslose und pünktliche Lieferung Ihrer Projekte.\nIhr PDA-Team", null);
                case PASSWORD_RESET -> new Copy("Ihr PDA-Code zum Zurücksetzen des Passworts",
                        "Geben Sie den folgenden Code ein, um Ihr Passwort zurückzusetzen.",
                        "Dieser Code ist 15 Minuten gültig und kann nur einmal verwendet werden.",
                        "Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren; Ihr Passwort bleibt unverändert.",
                        "Ihr PDA-Team", null);
                case PASSWORD_CHANGE -> new Copy("Ihr PDA-Code zum Ändern des Passworts",
                        "Geben Sie den folgenden Code ein, um Ihr Passwort in den Kontoeinstellungen zu ändern.",
                        "Dieser Code ist 15 Minuten gültig und kann nur einmal verwendet werden.",
                        "Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail und ändern Sie am besten Ihr Passwort.",
                        "Ihr PDA-Team", null);
                case ACCOUNT_DELETION -> new Copy("Löschung Ihres PDA-Kontos bestätigen",
                        "Möchten Sie Ihr Konto wirklich löschen? Ein gelöschtes Konto kann nicht wiederhergestellt werden.",
                        "Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden.",
                        "Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail; Ihr Konto wird nicht gelöscht.",
                        "Ihr PDA-Team", "Kontolöschung bestätigen");
            };
        };
    }
}
