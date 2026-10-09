package com.pda.contact.application.service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * A validated, normalised contact-form submission. The server never trusts the browser's checks: every value is
 * trimmed, bounded and free of control characters before it can reach a mail header or body.
 */
public record ContactMessage(String firstName, String lastName, String email, String message) {

    public static final int NAME_MAX = 80;
    public static final int EMAIL_MAX = 254;
    public static final int MESSAGE_MIN = 10;
    public static final int MESSAGE_MAX = 5_000;

    // Plain ASCII address: a local part of atext characters, a dotted domain; no quotes, comments, spaces or commas.
    private static final Pattern EMAIL = Pattern.compile(
            "^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
                    + "@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$");

    /** The submission broke one or more rules; {@link #fields()} names them. */
    public static class InvalidContactException extends RuntimeException {
        private final List<String> fields;

        public InvalidContactException(List<String> fields) {
            super("Invalid contact message");
            this.fields = List.copyOf(fields);
        }

        public List<String> fields() {
            return fields;
        }
    }

    public static ContactMessage validated(String firstName, String lastName, String email, String message) {
        List<String> invalid = new ArrayList<>();
        String first = name(firstName);
        String last = name(lastName);
        String address = email == null ? null : email.strip();
        String body = message == null ? null : message.replace("\r\n", "\n").replace('\r', '\n').strip();
        if (first == null) invalid.add("firstName");
        if (last == null) invalid.add("lastName");
        if (address == null || address.length() > EMAIL_MAX || !EMAIL.matcher(address).matches()
                || address.indexOf('@') > 64) {
            invalid.add("email");
        }
        if (body == null || body.codePointCount(0, body.length()) < MESSAGE_MIN
                || body.codePointCount(0, body.length()) > MESSAGE_MAX || hasForbiddenCharacter(body, true)) {
            invalid.add("message");
        }
        if (!invalid.isEmpty()) {
            throw new InvalidContactException(invalid);
        }
        return new ContactMessage(first, last, address, body);
    }

    private static String name(String value) {
        if (value == null) {
            return null;
        }
        String stripped = value.strip();
        int length = stripped.codePointCount(0, stripped.length());
        return length < 1 || length > NAME_MAX || hasForbiddenCharacter(stripped, false) ? null : stripped;
    }

    /** Control characters and Unicode line/paragraph separators; a message may still contain line feeds and tabs. */
    private static boolean hasForbiddenCharacter(String text, boolean allowLayout) {
        return text.codePoints().anyMatch(cp -> {
            if (allowLayout && (cp == '\n' || cp == '\t')) {
                return false;
            }
            return Character.isISOControl(cp) || cp == 0x2028 || cp == 0x2029;
        });
    }
}
