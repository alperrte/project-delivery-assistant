package com.pda.contact.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.pda.contact.application.service.ContactMessage.InvalidContactException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ContactMessageTest {

    private static final String TEXT = "Merhaba, uygulama hakkında bir sorum var.";

    private static List<String> invalidFields(String first, String last, String email, String message) {
        return assertThrows(InvalidContactException.class,
                () -> ContactMessage.validated(first, last, email, message)).fields();
    }

    @Test
    void valuesAreTrimmedAndLineEndingsNormalised() {
        ContactMessage message = ContactMessage.validated("  Ece ", " Yıldız  ", "  ece@example.com ",
                "  satır bir\r\nsatır iki\rsatır üç  ");
        assertEquals("Ece", message.firstName());
        assertEquals("Yıldız", message.lastName());
        assertEquals("ece@example.com", message.email());
        assertEquals("satır bir\nsatır iki\nsatır üç", message.message());
    }

    @Test
    void requiredFieldsAndWhitespaceOnlyValuesAreRejected() {
        assertEquals(List.of("firstName", "lastName", "email", "message"), invalidFields(null, null, null, null));
        assertEquals(List.of("firstName", "lastName", "email", "message"), invalidFields("   ", "\t", "  ", "          "));
    }

    @Test
    void lengthsAreBoundedInCodePoints() {
        assertEquals(List.of("firstName"), invalidFields("a".repeat(81), "Y", "a@b.co", TEXT));
        assertEquals(List.of("lastName"), invalidFields("E", "a".repeat(81), "a@b.co", TEXT));
        ContactMessage.validated("a".repeat(80), "b".repeat(80), "a@b.co", TEXT);
        assertEquals(List.of("message"), invalidFields("E", "Y", "a@b.co", "kısa"));
        assertEquals(List.of("message"), invalidFields("E", "Y", "a@b.co", "x".repeat(5_001)));
        ContactMessage.validated("E", "Y", "a@b.co", "x".repeat(5_000));
        ContactMessage.validated("E", "Y", "a@b.co", "x".repeat(10));
        // Ten emoji are ten characters, not twenty UTF-16 units.
        ContactMessage.validated("E", "Y", "a@b.co", "😀".repeat(10));
    }

    @ParameterizedTest
    @ValueSource(strings = {"plain", "a@b", "a@@b.co", "a b@c.co", "<a@b.co>", "\"a\"@b.co", "a@b.co, c@d.co",
            "a@b.co;c@d.co", "a@b.co\r\nBcc: x@y.co", "a@b.co\nCc: x@y.co", ".a@b.co", "a..b@c.co", "a@-b.co",
            "ünlü@b.co", "a@b.co ", "Name <a@b.co>"})
    void emailMustBeOneBareAsciiAddress(String email) {
        // " " at the end is stripped, so only the genuinely malformed values must fail.
        if (email.equals("a@b.co ")) {
            assertEquals("a@b.co", ContactMessage.validated("E", "Y", email, TEXT).email());
            return;
        }
        assertEquals(List.of("email"), invalidFields("E", "Y", email, TEXT), email);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Eve\r\nBcc: victim@example.com", "Eve\nX", "Ev\u0000e", "Ev e", "Ev e", "Ev\u007fe"})
    void controlCharactersInNamesAreRejectedSoNoHeaderCanBeAdded(String name) {
        assertEquals(List.of("firstName"), invalidFields(name, "Y", "a@b.co", TEXT));
        assertEquals(List.of("lastName"), invalidFields("E", name, "a@b.co", TEXT));
    }

    @Test
    void theMessageMayHaveLineFeedsAndTabsButNoOtherControlCharacter() {
        ContactMessage.validated("E", "Y", "a@b.co", "birinci satır\n\tikinci satır girintili");
        assertEquals(List.of("message"), invalidFields("E", "Y", "a@b.co", "merhaba dünya \u0000 nasılsın"));
        assertEquals(List.of("message"), invalidFields("E", "Y", "a@b.co", "merhaba dünya \u001b[31m nasılsın"));
        assertEquals(List.of("message"), invalidFields("E", "Y", "a@b.co", "merhaba dünya   nasılsın"));
    }
}
