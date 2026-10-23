package com.pda.meeting.internal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import static org.junit.jupiter.api.Assertions.*;

/** A reaction is exactly one emoji; text, markup and several emoji are refused. */
class ChatEmojiTest {
    @ParameterizedTest
    @ValueSource(strings={"👍","❤️","😂","✅","🎉","🚀","🔥","👍🏽","👨‍👩‍👧‍👦","🧑🏻‍🤝‍🧑🏿","🇹🇷","🇩🇪","1️⃣","#️⃣","🏴󠁧󠁢󠁥󠁮󠁧󠁿","‼️","™️"})
    void acceptsOneEmoji(String emoji) { assertTrue(ChatEmoji.valid(emoji),emoji); }

    @ParameterizedTest
    @ValueSource(strings={"","a","A","1","#","*","ab","👍👍","👍a","a👍"," 👍","👍 ","<b>","<script>","&amp;","\n","👍\n","\u0000","‍","️","👍‍","😀😀😀","😀 😀"})
    void refusesTextMarkupAndSeveralEmoji(String value) { assertFalse(ChatEmoji.valid(value),"'"+value+"'"); }

    @Test void refusesNullAndTooLong() {
        assertFalse(ChatEmoji.valid(null));
        assertFalse(ChatEmoji.valid("😀".repeat(20)));
        assertFalse(ChatEmoji.valid("👨" + "‍👩".repeat(20)));
    }
}
