package com.pda.analytics;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Public Analytics module contract for the platform administration dashboard. It returns aggregates of consented,
 * anonymous visit data only; there is no per-visitor or per-session detail and no link to any account. Callers must
 * authorize the platform administrator themselves.
 */
public interface AnalyticsReporting {

    /**
     * Visit figures for sessions/page views inside {@code [from, toExclusive)}; days are cut in {@code zone}. Days
     * without any visit are absent from {@link TrafficReport#daily()}.
     */
    TrafficReport traffic(Instant from, Instant toExclusive, ZoneId zone);

    record TrafficReport(long visits, long uniqueSessions, long uniqueVisitors, long averageEngagedSeconds,
                         List<DailyTraffic> daily, List<SourceCount> sources, List<NamedCount> topReferrers,
                         List<CampaignCount> topCampaigns) {}

    record DailyTraffic(LocalDate date, long visits, long sessions) {}

    /** {@code source} is one of DIRECT, SEARCH, REFERRAL, CAMPAIGN. */
    record SourceCount(String source, long sessions) {}

    record NamedCount(String name, long sessions) {}

    record CampaignCount(String source, String medium, String campaign, long sessions) {}
}
