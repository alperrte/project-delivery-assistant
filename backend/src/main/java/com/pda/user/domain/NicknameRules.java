package com.pda.user.domain;

import java.util.regex.Pattern;

/** Same alphabet and codepoint count as the existing registration/domain constraint. */
public final class NicknameRules {
    public static final String REGEX = "[\\p{L}\\p{N}_]{3,32}";
    private static final Pattern VALID = Pattern.compile(REGEX);
    private NicknameRules() {}
    public static String normalize(String value) {
        return value == null ? null : value.replaceAll("\\A\\p{IsWhite_Space}+|\\p{IsWhite_Space}+\\z", "");
    }
    public static boolean valid(String value) { return value != null && VALID.matcher(value).matches(); }
}
