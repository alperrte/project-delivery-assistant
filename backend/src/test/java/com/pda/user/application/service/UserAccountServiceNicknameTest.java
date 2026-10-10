package com.pda.user.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.pda.user.NicknameRules;
import org.junit.jupiter.api.Test;

class UserAccountServiceNicknameTest {

    @Test
    void providerNamesBecomeNaturalValidNicknames() {
        assertEquals("Hamza Taşbay", UserAccountService.nicknameBase("Hamza Taşbay"));
        assertEquals("Hamza Taşbay", UserAccountService.nicknameBase("  Hamza \t  Taşbay  "));
        assertEquals("Ayşe-Nur", UserAccountService.nicknameBase("Ayşe-Nur"));
        assertEquals("Hamza_Taşbay_27", UserAccountService.nicknameBase("Hamza_Taşbay_27"));
        assertEquals("Ali_Veli", UserAccountService.nicknameBase("Ali.Veli"));
        assertEquals("Ha_mza", UserAccountService.nicknameBase("Ha​mza"));
        assertEquals("Hamza _ Dev", UserAccountService.nicknameBase("Hamza 😀 Dev"));
        // decomposed (NFD) input is composed so the combining marks do not turn into underscores
        assertEquals("Çağrı", UserAccountService.nicknameBase("Çağrı"));
        for (String source : new String[] {"Hamza Taşbay", "Ali.Veli", "Hamza 😀 Dev", "  x y z  "}) {
            assertTrue(NicknameRules.valid(UserAccountService.nicknameBase(source)), source);
        }
    }

    @Test
    void shortOrSymbolOnlyNamesFallBackToUser() {
        assertEquals("user", UserAccountService.nicknameBase("ab"));
        assertEquals("user", UserAccountService.nicknameBase("!!! ... ???"));
        assertEquals("user", UserAccountService.nicknameBase("😀😀"));
    }

    @Test
    void truncationIsSurrogateSafeAndNeverEndsWithASeparator() {
        assertEquals("Abcdefghijklmnopqrstuv w", UserAccountService.nicknameBase("Abcdefghijklmnopqrstuv wxyz and more"));
        // the 24th code point is the space: it is trimmed again after the cut
        assertEquals("Abcdefghijklmnopqrstuvw", UserAccountService.nicknameBase("Abcdefghijklmnopqrstuvw xyz"));

        String result = UserAccountService.nicknameBase("a".repeat(23) + "𐐀𐐀");
        assertEquals(24, result.codePointCount(0, result.length()));
        assertTrue(NicknameRules.valid(result));
        assertTrue(Character.isLetter(result.codePointBefore(result.length())));
    }
}
