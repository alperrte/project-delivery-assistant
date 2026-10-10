package com.pda.contact.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SupportRequestPreviewTest {

    @Test
    void aShortMessageIsKeptAndLineBreaksBecomeSpaces() {
        assertEquals("Merhaba, bir sorum var. İkinci satır", SupportRequestService.preview("Merhaba,  bir sorum var.\n\tİkinci satır "));
    }

    @Test
    void aLongMessageIsCutAtOneHundredTwentyCodePointsWithoutSplittingAnEmoji() {
        String preview = SupportRequestService.preview("😀".repeat(200));
        assertEquals("😀".repeat(120) + "…", preview);
        assertEquals(120, preview.codePoints().filter(cp -> cp != '…').count());
        assertTrue(Character.isValidCodePoint(preview.codePointAt(preview.length() - 1)));
        assertEquals("x".repeat(120), SupportRequestService.preview("x".repeat(120)));
    }
}
