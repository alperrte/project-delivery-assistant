package com.pda.shared;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class StrongPasswordValidatorTest {

    private final StrongPasswordValidator validator = new StrongPasswordValidator();

    private boolean valid(String password) {
        return validator.isValid(password, null);
    }

    @Test
    void acceptsUppercaseDigitAndSpecialCharacter() {
        assertThat(valid("Abcdef1!")).isTrue();
        assertThat(valid("Şifre2026?")).isTrue();
        assertThat(valid("E2ePassword1!")).isTrue();
    }

    @Test
    void rejectsTheWeakPasswordFromTheAudit() {
        assertThat(valid("aaaaaaaa")).isFalse();
    }

    @Test
    void rejectsEachMissingClass() {
        assertThat(valid("abcdefg1!")).isFalse();
        assertThat(valid("ABCDEFGH!")).isFalse();
        assertThat(valid("Abcdefgh1")).isFalse();
        assertThat(valid("Abcdefgh!")).isFalse();
    }

    @Test
    void enforcesLengthBounds() {
        assertThat(valid("Abcde1!")).isFalse();
        assertThat(valid("Abcdef1!")).isTrue();
        assertThat(valid("A1!" + "a".repeat(125))).isTrue();
        assertThat(valid("A1!" + "a".repeat(126))).isFalse();
    }

    @Test
    void whitespaceIsNotASpecialCharacter() {
        assertThat(valid("Abcdefg1 ")).isFalse();
    }

    @Test
    void blankIsLeftToNotBlank() {
        assertThat(valid(null)).isTrue();
        assertThat(valid("  ")).isTrue();
    }
}
