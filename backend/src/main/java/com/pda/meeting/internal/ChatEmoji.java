package com.pda.meeting.internal;
import java.text.BreakIterator;
import java.util.Locale;

/**
 * What a reaction may be: exactly one emoji (one user-perceived character: a single symbol, a skin-tone or family sequence, a flag, a keycap),
 * never text. Anything else - letters, digits alone, markup, control characters, several emoji at once - is refused, so the reaction column
 * can only ever hold something that is drawn as one emoji and nothing a viewer could mistake for a message or an injection.
 */
final class ChatEmoji {
    static final int MAX_LENGTH = 32;
    private ChatEmoji() {}

    static boolean valid(String value) {
        if (value == null || value.isEmpty() || value.length() > MAX_LENGTH || !value.equals(value.strip())) return false;
        BreakIterator characters = BreakIterator.getCharacterInstance(Locale.ROOT);
        characters.setText(value);
        if (characters.next() != value.length()) return false;                       // more than one visible character
        boolean symbol = false, keycapBase = false;
        int[] points = value.codePoints().toArray();
        for (int i = 0; i < points.length; i++) {
            int cp = points[i];
            if (cp == 0x200D) { if (i == 0 || i == points.length - 1) return false; continue; }   // joiner between two parts
            if (cp == 0xFE0F || cp == 0xFE0E) { if (i == 0) return false; continue; }              // emoji / text presentation selector
            if (cp == 0x20E3) { if (!keycapBase) return false; continue; }                          // keycap ring
            if (cp >= 0xE0020 && cp <= 0xE007F) continue;                                           // flag subdivision tags
            if (cp >= 0x1F3FB && cp <= 0x1F3FF) continue;                                           // skin tones
            if ((cp >= '0' && cp <= '9') || cp == '#' || cp == '*') {                               // only as the base of a keycap
                if (i + 1 >= points.length || !(points[i + 1] == 0x20E3 || points[i + 1] == 0xFE0F)) return false;
                keycapBase = true; symbol = true; continue;
            }
            int type = Character.getType(cp);
            if (type == Character.OTHER_SYMBOL || type == Character.MODIFIER_SYMBOL) { symbol = true; continue; }
            if (cp == 0x203C || cp == 0x2049 || cp == 0x00A9 || cp == 0x00AE || cp == 0x2122) { symbol = true; continue; }   // emoji that are punctuation / letters by category
            return false;
        }
        return symbol;
    }
}
