package com.pda.task.infrastructure;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.Locale;
import java.util.UUID;

@Repository
public class TaskKeyCounter {
    private final JdbcTemplate jdbc;
    public TaskKeyCounter(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Key next(UUID projectId, String slug) {
        String prefix = slug.toUpperCase(Locale.ROOT);
        // PostgreSQL serializes the conflicting row update; the first prefix remains stable.
        return jdbc.queryForObject("INSERT INTO project_task_counters(project_id,key_prefix,last_value) "
                + "VALUES (?,?,1) ON CONFLICT (project_id) DO UPDATE SET "
                + "last_value = project_task_counters.last_value + 1 "
                + "RETURNING key_prefix,last_value", (rs, row) ->
                new Key(rs.getString(1), rs.getLong(2)), projectId, prefix);
    }
    public record Key(String prefix, long number) {
        public String taskKey() { return prefix + "-" + number; }
    }
}
