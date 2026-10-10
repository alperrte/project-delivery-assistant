package com.pda.user;

import java.util.regex.Pattern;

/**
 * Single source of truth for the nickname contract (public API of the User module).
 *
 * <p>Allowed: Unicode letters, Unicode digits, {@code _}, {@code -} and ordinary single spaces (U+0020) between
 * words; 3 to 32 code points. Leading/trailing whitespace is trimmed by {@link #normalize(String)} on every path
 * before validation; consecutive spaces, tabs, NBSP and other Unicode spaces, control and invisible characters are
 * invalid and are never silently rewritten.
 */
public final class NicknameRules {
    /** Compile-time constant so it can be used in {@code @Pattern(regexp = ...)}. */
    public static final String REGEX = "(?=[\\p{L}\\p{N}_ -]{3,32}\\z)[\\p{L}\\p{N}_-]+(?: [\\p{L}\\p{N}_-]+)*";
    private static final Pattern VALID = Pattern.compile(REGEX);
    private static final Pattern CONSECUTIVE_SPACES = Pattern.compile("  ");

    private NicknameRules() {}

    /** Trims leading and trailing Unicode White_Space only; inner characters are never touched. */
    public static String normalize(String value) {
        return value == null ? null : value.replaceAll("\\A\\p{IsWhite_Space}+|\\p{IsWhite_Space}+\\z", "");
    }

    public static boolean valid(String value) { return value != null && VALID.matcher(value).matches(); }

    /** True when the value contains two or more consecutive ordinary spaces (distinct validation reason). */
    public static boolean hasConsecutiveSpaces(String value) {
        return value != null && CONSECUTIVE_SPACES.matcher(value).find();
    }
}
