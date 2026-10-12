package com.pda.shared;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.InternetAddress;
import java.io.UnsupportedEncodingException;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/** Common SMTP transport configuration; credentials and the visible sender are independent. */
public record SmtpMailSettings(JavaMailSenderImpl sender, String fromAddress) {
    public static final String SENDER_NAME = "PDA — Project Delivery Assistant";
    public static final String DEFAULT_ADDRESS = "info@pd-assistant.com";

    public static SmtpMailSettings from(Environment environment) {
        if (!environment.getProperty("MAIL_ENABLED", Boolean.class, false)) {
            return new SmtpMailSettings(null, null);
        }
        String provider = environment.getProperty("MAIL_PROVIDER", "smtp");
        if (!"smtp".equalsIgnoreCase(provider) && !"brevo".equalsIgnoreCase(provider)) {
            throw new IllegalStateException("MAIL_PROVIDER must be smtp or brevo (SMTP relay)");
        }
        String address = environment.getProperty("SMTP_FROM_ADDRESS");
        if (address == null) address = environment.getProperty("MAIL_FROM", DEFAULT_ADDRESS);
        validateAddress(address);
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(required(environment, "SMTP_HOST"));
        int port = environment.getProperty("SMTP_PORT", Integer.class, 587);
        if (port < 1 || port > 65535) throw new IllegalStateException("SMTP_PORT is invalid");
        sender.setPort(port);
        sender.setDefaultEncoding("UTF-8");
        boolean auth = environment.getProperty("SMTP_AUTH", Boolean.class, true);
        boolean starttls = environment.getProperty("SMTP_STARTTLS", Boolean.class, true);
        boolean ssl = environment.getProperty("SMTP_SSL", Boolean.class, false);
        if (ssl && starttls) throw new IllegalStateException("Choose SMTP_STARTTLS or SMTP_SSL, not both");
        if ("prod".equalsIgnoreCase(environment.getProperty("APP_ENV", "dev")) && !starttls && !ssl) {
            throw new IllegalStateException("Production mail requires SMTP_STARTTLS or SMTP_SSL");
        }
        if (auth) {
            sender.setUsername(required(environment, "SMTP_USERNAME"));
            sender.setPassword(required(environment, "SMTP_PASSWORD"));
        }
        var properties = sender.getJavaMailProperties();
        properties.put("mail.smtp.auth", Boolean.toString(auth));
        properties.put("mail.smtp.starttls.enable", Boolean.toString(starttls));
        properties.put("mail.smtp.starttls.required", Boolean.toString(starttls));
        properties.put("mail.smtp.ssl.enable", Boolean.toString(ssl));
        properties.put("mail.smtp.ssl.checkserveridentity", "true");
        properties.put("mail.smtp.connectiontimeout", "5000");
        properties.put("mail.smtp.timeout", "5000");
        properties.put("mail.smtp.writetimeout", "5000");
        return new SmtpMailSettings(sender, address);
    }

    public static InternetAddress namedAddress(String address) {
        validateAddress(address);
        try {
            return new InternetAddress(address, SENDER_NAME, "UTF-8");
        } catch (UnsupportedEncodingException exception) {
            throw new IllegalStateException("UTF-8 mail encoding is unavailable");
        }
    }

    private static void validateAddress(String address) {
        try {
            if (address == null || address.isBlank() || address.chars().anyMatch(c ->
                    Character.isISOControl(c) || Character.isWhitespace(c) || ",;<>\"".indexOf(c) >= 0)) {
                throw new IllegalArgumentException();
            }
            InternetAddress[] parsed = InternetAddress.parse(address, true);
            if (parsed.length != 1 || parsed[0].getPersonal() != null
                    || !address.equals(parsed[0].getAddress())) throw new IllegalArgumentException();
            parsed[0].validate();
        } catch (MessagingException | IllegalArgumentException exception) {
            throw new IllegalStateException("SMTP_FROM_ADDRESS (or legacy MAIL_FROM) must be one bare email address");
        }
    }

    private static String required(Environment environment, String key) {
        String value = environment.getProperty(key);
        if (value == null || value.isBlank()) throw new IllegalStateException(key + " is required when mail is enabled");
        return value;
    }
}
