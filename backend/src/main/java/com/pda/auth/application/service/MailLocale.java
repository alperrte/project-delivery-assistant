package com.pda.auth.application.service;

import java.util.Locale;

/** Language of an outgoing account mail: the language the visitor was using on the site. Unknown values fall back to Turkish. */
public enum MailLocale {
    TR, EN, DE;

    public static MailLocale from(String value) {
        if (value == null) {
            return TR;
        }
        return switch (value.strip().toLowerCase(Locale.ROOT)) {
            case "en" -> EN;
            case "de" -> DE;
            default -> TR;
        };
    }
}
