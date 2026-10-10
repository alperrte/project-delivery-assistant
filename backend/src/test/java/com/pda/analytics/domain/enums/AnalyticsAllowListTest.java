package com.pda.analytics.domain.enums;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** The fixed lists the public endpoint accepts: exact, case-sensitive and nothing a person could type. */
class AnalyticsAllowListTest {

    @Test
    void theCtaIdsAreTheDocumentedFixedList() {
        assertEquals(java.util.List.of("landing_register", "landing_login", "header_register", "header_login",
                "register_submit", "contact_submit", "github_repo"),
                Arrays.stream(AnalyticsCtaId.values()).map(AnalyticsCtaId::id).toList());
        for (AnalyticsCtaId cta : AnalyticsCtaId.values()) {
            assertEquals(Optional.of(cta), AnalyticsCtaId.parse(cta.id()));
            assertTrue(cta.id().matches("^[a-z][a-z0-9_]*$") && cta.id().length() <= 40, cta.id());
        }
    }

    @Test
    void ctaParsingIsExact() {
        for (String value : new String[] {null, "", " ", "LANDING_REGISTER", "landing_register ", " landing_register",
                "landing-register", "landing_register;", "buy_now", "a@b.example"}) {
            assertEquals(Optional.empty(), AnalyticsCtaId.parse(value), String.valueOf(value));
        }
    }

    @Test
    void theErrorKindsAreTheDocumentedFixedList() {
        assertEquals(java.util.List.of("render", "chunk_load", "unhandled_rejection", "network"),
                Arrays.stream(AnalyticsErrorKind.values()).map(AnalyticsErrorKind::id).toList());
        for (AnalyticsErrorKind kind : AnalyticsErrorKind.values()) {
            assertEquals(Optional.of(kind), AnalyticsErrorKind.parse(kind.id()));
            // The enum name is what the table CHECK constraint lists.
            assertEquals(kind.name().toLowerCase(java.util.Locale.ROOT), kind.id());
        }
        for (String value : new String[] {null, "", "RENDER", "Render", "TypeError", "render "}) {
            assertEquals(Optional.empty(), AnalyticsErrorKind.parse(value), String.valueOf(value));
        }
    }
}
