package com.pda.contact.infrastructure.repository;

import com.pda.contact.ContactReporting.DailyCount;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Read-only daily counts of delivered submissions. Every parameter is bound. */
@Repository
public class ContactReportQueries {

    private final JdbcClient jdbc;

    public ContactReportQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<DailyCount> dailySent(Instant from, Instant toExclusive, ZoneId zone) {
        return jdbc.sql("""
                SELECT (created_at AT TIME ZONE :zone)::date AS day, count(*) AS total
                FROM contact_requests
                WHERE delivery_status = 'SENT' AND created_at >= :from AND created_at < :to
                GROUP BY 1 ORDER BY 1
                """).param("zone", zone.getId()).param("from", utc(from)).param("to", utc(toExclusive))
                .query((rs, row) -> new DailyCount(rs.getDate("day").toLocalDate(), rs.getLong("total"))).list();
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
