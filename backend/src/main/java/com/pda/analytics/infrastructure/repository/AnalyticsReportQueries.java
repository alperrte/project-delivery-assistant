package com.pda.analytics.infrastructure.repository;

import com.pda.analytics.AnalyticsReporting.CampaignConversion;
import com.pda.analytics.AnalyticsReporting.CampaignCount;
import com.pda.analytics.AnalyticsReporting.ClientErrorReport;
import com.pda.analytics.AnalyticsReporting.ConversionReport;
import com.pda.analytics.AnalyticsReporting.CtaStat;
import com.pda.analytics.AnalyticsReporting.DailyTraffic;
import com.pda.analytics.AnalyticsReporting.FlowStep;
import com.pda.analytics.AnalyticsReporting.KindCount;
import com.pda.analytics.AnalyticsReporting.NamedCount;
import com.pda.analytics.AnalyticsReporting.NotFoundStat;
import com.pda.analytics.AnalyticsReporting.PageStat;
import com.pda.analytics.AnalyticsReporting.PathCount;
import com.pda.analytics.AnalyticsReporting.RouteErrorCount;
import com.pda.analytics.AnalyticsReporting.SourceConversion;
import com.pda.analytics.AnalyticsReporting.SourceCount;
import com.pda.analytics.domain.enums.AnalyticsCtaId;
import com.pda.analytics.domain.enums.AnalyticsErrorKind;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.ZoneId;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Read-only aggregate queries over the anonymous analytics tables. Every parameter is bound; nothing is concatenated. */
@Repository
public class AnalyticsReportQueries {

    private static final int TOP_LIMIT = 10;
    /** The route template of the not-found page. */
    static final String NOT_FOUND_PATH = "/not-found";

    private final JdbcClient jdbc;

    public AnalyticsReportQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long visits(Instant from, Instant to) {
        return jdbc.sql("SELECT count(*) FROM analytics_page_views WHERE occurred_at >= :from AND occurred_at < :to")
                .param("from", utc(from)).param("to", utc(to)).query(Long.class).single();
    }

    public long uniqueSessions(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT count(DISTINCT session_id) FROM analytics_page_views
                WHERE occurred_at >= :from AND occurred_at < :to
                """).param("from", utc(from)).param("to", utc(to)).query(Long.class).single();
    }

    public long uniqueVisitors(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT count(DISTINCT s.visitor_id) FROM analytics_page_views v
                JOIN analytics_sessions s ON s.id = v.session_id
                WHERE v.occurred_at >= :from AND v.occurred_at < :to
                """).param("from", utc(from)).param("to", utc(to)).query(Long.class).single();
    }

    /** Mean active seconds of the sessions that started in the range, rounded; 0 when there are none. */
    public long averageEngagedSeconds(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT COALESCE(round(avg(engaged_seconds)), 0) FROM analytics_sessions
                WHERE started_at >= :from AND started_at < :to
                """).param("from", utc(from)).param("to", utc(to)).query(Long.class).single();
    }

    public List<DailyTraffic> daily(Instant from, Instant to, ZoneId zone) {
        return jdbc.sql("""
                SELECT (occurred_at AT TIME ZONE :zone)::date AS day, count(*) AS visits,
                       count(DISTINCT session_id) AS sessions
                FROM analytics_page_views
                WHERE occurred_at >= :from AND occurred_at < :to
                GROUP BY 1 ORDER BY 1
                """).param("zone", zone.getId()).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new DailyTraffic(rs.getDate("day").toLocalDate(), rs.getLong("visits"),
                        rs.getLong("sessions")))
                .list();
    }

    public List<SourceCount> sources(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT source_type, count(*) AS sessions FROM analytics_sessions
                WHERE started_at >= :from AND started_at < :to
                GROUP BY source_type ORDER BY sessions DESC, source_type
                """).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new SourceCount(rs.getString("source_type"), rs.getLong("sessions"))).list();
    }

    public List<NamedCount> topReferrers(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT referrer_domain, count(*) AS sessions FROM analytics_sessions
                WHERE started_at >= :from AND started_at < :to AND referrer_domain IS NOT NULL
                GROUP BY referrer_domain ORDER BY sessions DESC, referrer_domain LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new NamedCount(rs.getString("referrer_domain"), rs.getLong("sessions"))).list();
    }

    public List<CampaignCount> topCampaigns(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT utm_source, utm_medium, utm_campaign, count(*) AS sessions FROM analytics_sessions
                WHERE started_at >= :from AND started_at < :to AND source_type = 'CAMPAIGN'
                GROUP BY utm_source, utm_medium, utm_campaign
                ORDER BY sessions DESC, utm_campaign, utm_source, utm_medium LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new CampaignCount(rs.getString("utm_source"), rs.getString("utm_medium"),
                        rs.getString("utm_campaign"), rs.getLong("sessions"))).list();
    }

    public List<PageStat> topPages(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT path, count(*) AS views, count(DISTINCT session_id) AS sessions FROM analytics_page_views
                WHERE occurred_at >= :from AND occurred_at < :to
                GROUP BY path ORDER BY views DESC, path LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new PageStat(rs.getString("path"), rs.getLong("views"), rs.getLong("sessions")))
                .list();
    }

    /** First page of the sessions that started in the range. */
    public List<PathCount> entryPages(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT entry_path AS path, count(*) AS sessions FROM analytics_sessions
                WHERE started_at >= :from AND started_at < :to
                GROUP BY entry_path ORDER BY sessions DESC, entry_path LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new PathCount(rs.getString("path"), rs.getLong("sessions"))).list();
    }

    /** Last page view of the sessions that started in the range. */
    public List<PathCount> exitPages(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT last_view.path AS path, count(*) AS sessions FROM (
                    SELECT DISTINCT ON (v.session_id) v.path AS path
                    FROM analytics_page_views v JOIN analytics_sessions s ON s.id = v.session_id
                    WHERE s.started_at >= :from AND s.started_at < :to
                    ORDER BY v.session_id, v.occurred_at DESC, v.id DESC
                ) last_view
                GROUP BY last_view.path ORDER BY sessions DESC, last_view.path LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new PathCount(rs.getString("path"), rs.getLong("sessions"))).list();
    }

    /** First page to second page view of the sessions that started in the range. */
    public List<FlowStep> flows(Instant from, Instant to) {
        return jdbc.sql("""
                WITH ordered AS (
                    SELECT v.path AS path,
                           lead(v.path) OVER (PARTITION BY v.session_id ORDER BY v.occurred_at, v.id) AS next_path,
                           row_number() OVER (PARTITION BY v.session_id ORDER BY v.occurred_at, v.id) AS pos
                    FROM analytics_page_views v JOIN analytics_sessions s ON s.id = v.session_id
                    WHERE s.started_at >= :from AND s.started_at < :to
                )
                SELECT path AS from_path, next_path AS to_path, count(*) AS sessions FROM ordered
                WHERE pos = 1 AND next_path IS NOT NULL
                GROUP BY path, next_path ORDER BY sessions DESC, path, next_path LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new FlowStep(rs.getString("from_path"), rs.getString("to_path"),
                        rs.getLong("sessions"))).list();
    }

    public NotFoundStat notFound(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT count(*) AS views, count(DISTINCT session_id) AS sessions FROM analytics_page_views
                WHERE path = :path AND occurred_at >= :from AND occurred_at < :to
                """).param("path", NOT_FOUND_PATH).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new NotFoundStat(rs.getLong("views"), rs.getLong("sessions"))).single();
    }

    public List<CtaStat> ctas(Instant from, Instant to) {
        return jdbc.sql("""
                SELECT cta_id, count(*) AS clicks, count(DISTINCT session_id) AS sessions FROM analytics_cta_clicks
                WHERE occurred_at >= :from AND occurred_at < :to
                GROUP BY cta_id ORDER BY clicks DESC, cta_id
                """).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new CtaStat(rs.getString("cta_id"), rs.getLong("clicks"), rs.getLong("sessions")))
                .list();
    }

    /** Sessions that started in the range and those among them that clicked register_submit, by source and campaign. */
    public ConversionReport conversions(Instant from, Instant to) {
        String converted = """
                count(*) FILTER (WHERE EXISTS (SELECT 1 FROM analytics_cta_clicks c
                    WHERE c.session_id = s.id AND c.cta_id = :cta))
                """;
        String cta = AnalyticsCtaId.REGISTER_SUBMIT.id();
        long[] totals = jdbc.sql("SELECT count(*) AS sessions, " + converted
                + " AS converted FROM analytics_sessions s WHERE s.started_at >= :from AND s.started_at < :to")
                .param("cta", cta).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new long[] {rs.getLong("sessions"), rs.getLong("converted")}).single();
        List<SourceConversion> bySource = jdbc.sql("SELECT s.source_type AS source, count(*) AS sessions, " + converted
                + " AS converted FROM analytics_sessions s WHERE s.started_at >= :from AND s.started_at < :to"
                + " GROUP BY s.source_type ORDER BY converted DESC, sessions DESC, s.source_type")
                .param("cta", cta).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new SourceConversion(rs.getString("source"), rs.getLong("sessions"),
                        rs.getLong("converted"))).list();
        List<CampaignConversion> byCampaign = jdbc.sql("SELECT s.utm_source, s.utm_medium, s.utm_campaign,"
                + " count(*) AS sessions, " + converted + " AS converted FROM analytics_sessions s"
                + " WHERE s.started_at >= :from AND s.started_at < :to AND s.source_type = 'CAMPAIGN'"
                + " GROUP BY s.utm_source, s.utm_medium, s.utm_campaign"
                + " ORDER BY converted DESC, sessions DESC, s.utm_campaign, s.utm_source, s.utm_medium LIMIT :limit")
                .param("cta", cta).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new CampaignConversion(rs.getString("utm_source"), rs.getString("utm_medium"),
                        rs.getString("utm_campaign"), rs.getLong("sessions"), rs.getLong("converted"))).list();
        return new ConversionReport(totals[0], totals[1], bySource, byCampaign);
    }

    public ClientErrorReport clientErrors(Instant from, Instant to) {
        List<KindCount> byKind = jdbc.sql("""
                SELECT error_kind, count(*) AS total FROM analytics_client_errors
                WHERE occurred_at >= :from AND occurred_at < :to
                GROUP BY error_kind ORDER BY total DESC, error_kind
                """).param("from", utc(from)).param("to", utc(to))
                .query((rs, row) -> new KindCount(AnalyticsErrorKind.valueOf(rs.getString("error_kind")).id(),
                        rs.getLong("total"))).list();
        List<RouteErrorCount> byRoute = jdbc.sql("""
                SELECT path, error_kind, count(*) AS total FROM analytics_client_errors
                WHERE occurred_at >= :from AND occurred_at < :to
                GROUP BY path, error_kind ORDER BY total DESC, path, error_kind LIMIT :limit
                """).param("from", utc(from)).param("to", utc(to)).param("limit", TOP_LIMIT)
                .query((rs, row) -> new RouteErrorCount(rs.getString("path"),
                        AnalyticsErrorKind.valueOf(rs.getString("error_kind")).id(), rs.getLong("total"))).list();
        return new ClientErrorReport(byKind.stream().mapToLong(KindCount::count).sum(), byKind, byRoute);
    }

    /** timestamptz columns are compared with an offset date-time, so the JVM time zone never shifts the range. */
    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
