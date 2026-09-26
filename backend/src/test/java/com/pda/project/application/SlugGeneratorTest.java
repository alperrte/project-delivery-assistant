package com.pda.project.application;

import com.pda.project.application.service.SlugGenerator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SlugGeneratorTest {

    @Test
    void transliteratesTurkishNamesAndAddsUniqueSuffix() {
        String first = SlugGenerator.generate("Öğrenci İşleri Çalışması");
        String second = SlugGenerator.generate("Öğrenci İşleri Çalışması");

        assertTrue(first.startsWith("ogrenci-isleri-calismasi-"));
        assertNotEquals(first, second);
        assertTrue(first.length() <= 100);
    }

    @Test
    void rejectsNameWithoutUsableSlugCharacters() {
        assertThrows(IllegalArgumentException.class, () -> SlugGenerator.generate("!!!"));
    }
}
