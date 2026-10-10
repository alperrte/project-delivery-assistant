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

    /**
     * Page, call-to-action, conversion and client-error figures for {@code [from, toExclusive)}. Sessions are the ones that
     * started in the range (pages, flows, conversions); clicks and errors are the ones that happened in it. Every list is
     * limited to the top ten entries. Routes are templates ("/projects/[slug]"), never a concrete id or query.
     */
    BehaviorReport behavior(Instant from, Instant toExclusive);

    /** {@code views} counts page views of the route; {@code sessions} the distinct sessions that viewed it. */
    record PageStat(String path, long views, long sessions) {}

    /** {@code sessions} is the number of sessions that entered on, or left from, {@code path}. */
    record PathCount(String path, long sessions) {}

    /** Sessions whose first page was {@code fromPath} and whose second page view was {@code toPath}. */
    record FlowStep(String fromPath, String toPath, long sessions) {}

    record NotFoundStat(long views, long sessions) {}

    /** Clicks on one call-to-action id and the distinct sessions that clicked it. */
    record CtaStat(String ctaId, long clicks, long sessions) {}

    /**
     * Sessions that started in the range, and how many of them clicked {@code register_submit}, for one traffic source
     * type (DIRECT, SEARCH, REFERRAL, CAMPAIGN).
     */
    record SourceConversion(String source, long sessions, long converted) {}

    /** The same for one UTM source / medium / campaign (campaign sessions only). */
    record CampaignConversion(String source, String medium, String campaign, long sessions, long converted) {}

    record ConversionReport(long sessions, long converted, List<SourceConversion> bySource,
                            List<CampaignConversion> byCampaign) {}

    record KindCount(String kind, long count) {}

    record RouteErrorCount(String path, String kind, long count) {}

    record ClientErrorReport(long total, List<KindCount> byKind, List<RouteErrorCount> byRoute) {}

    record BehaviorReport(List<PageStat> topPages, List<PathCount> entryPages, List<PathCount> exitPages,
                          List<FlowStep> flows, NotFoundStat notFound, List<CtaStat> ctas,
                          ConversionReport conversions, ClientErrorReport clientErrors) {}

    record TrafficReport(long visits, long uniqueSessions, long uniqueVisitors, long averageEngagedSeconds,
                         List<DailyTraffic> daily, List<SourceCount> sources, List<NamedCount> topReferrers,
                         List<CampaignCount> topCampaigns) {}

    record DailyTraffic(LocalDate date, long visits, long sessions) {}

    /** {@code source} is one of DIRECT, SEARCH, REFERRAL, CAMPAIGN. */
    record SourceCount(String source, long sessions) {}

    record NamedCount(String name, long sessions) {}

    record CampaignCount(String source, String medium, String campaign, long sessions) {}
}
