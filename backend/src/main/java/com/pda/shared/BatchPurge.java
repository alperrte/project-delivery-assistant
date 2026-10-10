package com.pda.shared;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Deletes expired rows in bounded batches, so a retention run never holds one huge lock or transaction. Each batch is its
 * own statement (auto-commit); the run is idempotent: a second run, or a run that was interrupted halfway, simply finds
 * fewer rows. {@code table} and {@code condition} are constants written in code by the calling job, never request data;
 * the cut-off is always a bound parameter.
 */
@Component
public class BatchPurge {

    private final JdbcClient jdbc;

    /** The instant {@code months} calendar months before {@code now}, cut in UTC so it never depends on the server zone. */
    public static Instant monthsBefore(Instant now, int months) {
        return now.atZone(ZoneOffset.UTC).minusMonths(months).toInstant();
    }

    public static Instant daysBefore(Instant now, int days) {
        return now.atZone(ZoneOffset.UTC).minusDays(days).toInstant();
    }

    public BatchPurge(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Deletes rows of {@code table} (which has a UUID primary key {@code id}) where {@code condition} holds. The
     * condition may use the named parameter {@code :cutoff}. Returns the number of rows removed.
     */
    public long deleteInBatches(String table, String condition, Instant cutoff, int batchSize) {
        int size = Math.max(1, batchSize);
        OffsetDateTime bound = cutoff.atOffset(ZoneOffset.UTC);
        String sql = "DELETE FROM " + table + " WHERE id IN (SELECT id FROM " + table + " WHERE " + condition
                + " LIMIT " + size + ")";
        long total = 0;
        int removed;
        do {
            removed = jdbc.sql(sql).param("cutoff", bound).update();
            total += removed;
        } while (removed >= size);
        return total;
    }
}
