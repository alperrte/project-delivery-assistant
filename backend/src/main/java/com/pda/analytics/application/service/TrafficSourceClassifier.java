package com.pda.analytics.application.service;

import com.pda.analytics.domain.enums.TrafficSourceType;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Decides where a visit came from, from what the browser reported on the first page of a session: the host of the
 * referring page and the campaign parameters. It never guesses: a visit without referrer and without campaign
 * parameters is DIRECT (it may well have been a shared link, but nothing says so), and CAMPAIGN needs real UTM values.
 */
public final class TrafficSourceClassifier {

    private static final int MAX_FIELD = 100;
    private static final Pattern HOST = Pattern.compile(
            "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$");
    private static final Pattern CAMPAIGN_VALUE = Pattern.compile("^[\\p{L}\\p{N} _.:+@/\\-]{1,100}$");
    private static final Pattern SEARCH_ENGINE = Pattern.compile(
            "^(?:(?:[a-z0-9-]+\\.)*google\\.[a-z]{2,3}(?:\\.[a-z]{2})?"
                    + "|(?:[a-z0-9-]+\\.)*bing\\.com"
                    + "|(?:[a-z0-9-]+\\.)*duckduckgo\\.com"
                    + "|(?:[a-z0-9-]+\\.)*yandex\\.[a-z]{2,3}(?:\\.[a-z]{2})?"
                    + "|(?:[a-z0-9-]+\\.)*yahoo\\.[a-z]{2,3}(?:\\.[a-z]{2})?"
                    + "|(?:[a-z0-9-]+\\.)*baidu\\.com"
                    + "|(?:[a-z0-9-]+\\.)*ecosia\\.org"
                    + "|search\\.brave\\.com"
                    + "|(?:[a-z0-9-]+\\.)*startpage\\.com"
                    + "|(?:[a-z0-9-]+\\.)*qwant\\.com"
                    + "|(?:[a-z0-9-]+\\.)*ask\\.com"
                    + "|(?:[a-z0-9-]+\\.)*naver\\.com"
                    + "|(?:[a-z0-9-]+\\.)*seznam\\.cz)$");

    private TrafficSourceClassifier() {
    }

    public record Result(TrafficSourceType type, String referrerDomain, String utmSource, String utmMedium,
                         String utmCampaign) {}

    /**
     * @param referrerHost the referring page's host as the browser reported it (never a URL); may be null or invalid
     * @param ownHost      the application's own host; a referrer from the application itself is not a source
     */
    public static Result classify(String referrerHost, String utmSource, String utmMedium, String utmCampaign,
                                  String ownHost) {
        String source = campaignValue(utmSource);
        String medium = campaignValue(utmMedium);
        String campaign = campaignValue(utmCampaign);
        String referrer = referrerDomain(referrerHost, ownHost);
        TrafficSourceType type;
        if (source != null || medium != null || campaign != null) {
            type = TrafficSourceType.CAMPAIGN;
        } else if (referrer == null) {
            type = TrafficSourceType.DIRECT;
        } else if (SEARCH_ENGINE.matcher(referrer).matches()) {
            type = TrafficSourceType.SEARCH;
        } else {
            type = TrafficSourceType.REFERRAL;
        }
        return new Result(type, referrer, source, medium, campaign);
    }

    /** The lower-cased host without a leading "www.", or null when it is missing, malformed or the application itself. */
    static String referrerDomain(String host, String ownHost) {
        if (host == null) {
            return null;
        }
        String normalized = normalizeHost(host);
        if (normalized == null) {
            return null;
        }
        String own = ownHost == null ? null : normalizeHost(ownHost);
        return normalized.equals(own) ? null : normalized;
    }

    private static String normalizeHost(String host) {
        String value = host.strip().toLowerCase(Locale.ROOT);
        if (value.startsWith("www.")) {
            value = value.substring(4);
        }
        return value.length() <= MAX_FIELD && HOST.matcher(value).matches() ? value : null;
    }

    /** A campaign value is kept only when it is short plain text; anything else is dropped rather than stored. */
    static String campaignValue(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return CAMPAIGN_VALUE.matcher(trimmed).matches() ? trimmed : null;
    }
}
