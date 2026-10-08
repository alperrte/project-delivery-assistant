package com.pda.project.application.service;

import java.util.regex.Pattern;

/**
 * Validation of the two caller-supplied strings that end up in GitHub URLs (branch name, author login). They are
 * only ever passed as encoded URI variables, and a branch must additionally exist in the cached branch list, so
 * this is defence in depth plus an early 400 for obviously invalid input.
 */
public final class RepositoryReadInput {

    static final int MAX_BRANCH_LENGTH = 250;
    private static final Pattern GITHUB_LOGIN = Pattern.compile("^[A-Za-z0-9-]{1,39}$");

    private RepositoryReadInput() {}

    /** Git ref rules: no control characters or whitespace, none of {@code ~ ^ : ? * [ \}, no {@code ..} or {@code @{}. */
    public static String branch(String value) {
        if (value == null || value.isBlank() || value.length() > MAX_BRANCH_LENGTH || value.startsWith("/")
                || value.endsWith("/") || value.endsWith(".") || value.contains("..") || value.contains("//")
                || value.contains("@{")) {
            throw new IllegalArgumentException("Invalid branch");
        }
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            if (character <= 0x20 || character == 0x7f || "~^:?*[\\".indexOf(character) >= 0) {
                throw new IllegalArgumentException("Invalid branch");
            }
        }
        return value;
    }

    /** Blank means "no author filter". */
    public static String author(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        if (!GITHUB_LOGIN.matcher(value).matches()) {
            throw new IllegalArgumentException("Invalid author");
        }
        return value;
    }
}
