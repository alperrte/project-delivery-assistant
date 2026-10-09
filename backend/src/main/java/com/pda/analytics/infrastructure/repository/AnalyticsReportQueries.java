package com.pda.analytics.infrastructure.repository;

import com.pda.analytics.AnalyticsReporting.CampaignCount;
import com.pda.analytics.AnalyticsReporting.DailyTraffic;
import com.pda.analytics.AnalyticsReporting.NamedCount;
import com.pda.analytics.AnalyticsReporting.SourceCount;
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

    /** timestamptz columns are compared with an offset date-time, so the JVM time zone never shifts the range. */
    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
