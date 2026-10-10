package com.pda.user;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class NicknameRulesTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "Hamza", "Hamza Taşbay", "hamza_tasbay", "hamza-tasbay", "Hamza Taşbay 27", "Hamza_Taşbay-27",
            "Çağrı Öztürk", "Ali Veli", "Ayşe-Nur", "abc", "123", "a b", "-_-", "İpek_Çelik",
            "𐐀𐐀𐐀"})
    void acceptsNaturalNames(String value) {
        assertTrue(NicknameRules.valid(value), value);
        assertTrue(value.matches(NicknameRules.REGEX), value);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "ab", "", " ", "   ", " abc", "abc ", "Hamza  Taşbay", "Hamza   Taşbay", "Hamza\tTaşbay", "Hamza\nTaşbay",
            "Hamza\rTaşbay", "Hamza Taşbay", "Hamza Taşbay", "Hamza　Taşbay", "Ha​mza",
            "Ha‍mza", "Ha﻿mza", "Ha⁠mza", "Ha\u0000mza", "Ha\u0007mza", "<script>", "a@b", "a.b", "a+b", "a/b",
            "😀😀😀", "Ha😀mza", "café", "abc\n", "abc "})
    void rejectsAmbiguousOrUnsafeNames(String value) {
        assertFalse(NicknameRules.valid(value), value);
        assertFalse(value.matches(NicknameRules.REGEX), value);
    }

    @Test
    void lengthIsCountedInCodePointsBetweenThreeAndThirtyTwo() {
        assertFalse(NicknameRules.valid("a".repeat(2)));
        assertTrue(NicknameRules.valid("a".repeat(3)));
        assertTrue(NicknameRules.valid("a".repeat(32)));
        assertFalse(NicknameRules.valid("a".repeat(33)));
        assertTrue(NicknameRules.valid("ab c".repeat(8)));
        assertFalse(NicknameRules.valid("ab c".repeat(8) + "d"));
        assertTrue(NicknameRules.valid("𐐀".repeat(32)));
        assertFalse(NicknameRules.valid("𐐀".repeat(33)));
        assertFalse(NicknameRules.valid(null));
    }

    @Test
    void normalizeTrimsOnlyLeadingAndTrailingWhiteSpace() {
        assertEquals("Hamza Taşbay", NicknameRules.normalize("  Hamza Taşbay  "));
        assertEquals("Hamza Taşbay", NicknameRules.normalize("\t \n Hamza Taşbay  \r"));
        assertEquals("Hamza  Taşbay", NicknameRules.normalize(" Hamza  Taşbay "));
        assertEquals("Hamza\tTaşbay", NicknameRules.normalize("Hamza\tTaşbay"));
        assertEquals("", NicknameRules.normalize("   "));
        assertNull(NicknameRules.normalize(null));
        assertTrue(NicknameRules.valid(NicknameRules.normalize("  Hamza Taşbay  ")));
        // double spaces and invisible characters survive trimming, so validation rejects them
        assertFalse(NicknameRules.valid(NicknameRules.normalize("  Hamza  Taşbay  ")));
        assertFalse(NicknameRules.valid(NicknameRules.normalize("​Hamza")));
    }

    @Test
    void reportsConsecutiveSpacesForADistinctMessage() {
        assertTrue(NicknameRules.hasConsecutiveSpaces("Hamza  Taşbay"));
        assertFalse(NicknameRules.hasConsecutiveSpaces("Hamza Taşbay"));
        assertFalse(NicknameRules.hasConsecutiveSpaces(null));
    }
}
