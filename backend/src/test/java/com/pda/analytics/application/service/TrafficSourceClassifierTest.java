package com.pda.analytics.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.pda.analytics.domain.enums.TrafficSourceType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class TrafficSourceClassifierTest {

    private static final String OWN = "localhost";

    @Test
    void noReferrerAndNoCampaignIsDirectNeverASharedLink() {
        var result = TrafficSourceClassifier.classify(null, null, null, null, OWN);
        assertEquals(TrafficSourceType.DIRECT, result.type());
        assertNull(result.referrerDomain());
        assertEquals(TrafficSourceType.DIRECT, TrafficSourceClassifier.classify("  ", "", null, null, OWN).type());
    }

    @ParameterizedTest
    @ValueSource(strings = {"www.google.com", "google.com.tr", "www.google.de", "bing.com", "www.bing.com",
            "duckduckgo.com", "yandex.com.tr", "yandex.ru", "search.yahoo.com", "ecosia.org", "search.brave.com",
            "www.baidu.com", "startpage.com"})
    void knownSearchEnginesAreSearch(String host) {
        var result = TrafficSourceClassifier.classify(host, null, null, null, OWN);
        assertEquals(TrafficSourceType.SEARCH, result.type(), host);
        assertEquals(host.startsWith("www.") ? host.substring(4) : host, result.referrerDomain());
    }

    @ParameterizedTest
    @ValueSource(strings = {"example.org", "news.ycombinator.com", "notgoogle.com", "google.evil.example",
            "github.com", "t.co"})
    void anyOtherHostIsReferral(String host) {
        assertEquals(TrafficSourceType.REFERRAL, TrafficSourceClassifier.classify(host, null, null, null, OWN).type(),
                host);
    }

    @Test
    void utmValuesMakeACampaignAndKeepTheReferrerDomain() {
        var result = TrafficSourceClassifier.classify("example.org", "newsletter", "email", "launch-2026", OWN);
        assertEquals(TrafficSourceType.CAMPAIGN, result.type());
        assertEquals("newsletter", result.utmSource());
        assertEquals("email", result.utmMedium());
        assertEquals("launch-2026", result.utmCampaign());
        assertEquals("example.org", result.referrerDomain());
        // One parameter is enough; the others stay empty.
        var onlyCampaign = TrafficSourceClassifier.classify(null, null, null, "spring", OWN);
        assertEquals(TrafficSourceType.CAMPAIGN, onlyCampaign.type());
        assertNull(onlyCampaign.utmSource());
    }

    @Test
    void theApplicationItselfIsNotASource() {
        assertEquals(TrafficSourceType.DIRECT, TrafficSourceClassifier.classify("localhost", null, null, null, OWN).type());
        assertEquals(TrafficSourceType.DIRECT, TrafficSourceClassifier.classify("WWW.LOCALHOST", null, null, null, OWN).type());
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://example.org/path?token=secret", "exa mple.org", "example.org/path", "-bad.org",
            "evil.org\r\nX-Injected: 1", "exämple.org", "a..b"})
    void aMalformedReferrerIsDroppedNotStored(String host) {
        var result = TrafficSourceClassifier.classify(host, null, null, null, OWN);
        assertEquals(TrafficSourceType.DIRECT, result.type(), host);
        assertNull(result.referrerDomain());
    }

    @Test
    void campaignValuesMustBeShortPlainText() {
        assertNull(TrafficSourceClassifier.campaignValue("<script>alert(1)</script>"));
        assertNull(TrafficSourceClassifier.campaignValue("a\nb"));
        assertNull(TrafficSourceClassifier.campaignValue("x".repeat(101)));
        assertNull(TrafficSourceClassifier.campaignValue("   "));
        assertEquals("spring sale_2026", TrafficSourceClassifier.campaignValue("  spring sale_2026 "));
        // A rejected value cannot turn a visit into a campaign.
        assertEquals(TrafficSourceType.DIRECT,
                TrafficSourceClassifier.classify(null, "<b>x</b>", null, null, OWN).type());
    }
}
