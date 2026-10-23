package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

/** V55 on top of a real V54 database: old meetings and the V54 reminder queue survive untouched and keep working. */
@Testcontainers
class MeetingV55MigrationTest {
    @Container static PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:18-alpine");
    @Test void v55KeepsOldMeetingsAndTheV54ReminderQueueAndAddsIconHistoryAndReasons() throws Exception {
        String url=postgres.getJdbcUrl(),name=postgres.getUsername(),password=postgres.getPassword();
        Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("54").load().migrate();
        try(var connection=DriverManager.getConnection(url,name,password);var sql=connection.createStatement()) {
            String user="00000000-0000-0000-0000-000000000001",other="00000000-0000-0000-0000-000000000004",project="00000000-0000-0000-0000-000000000002",meeting="00000000-0000-0000-0000-000000000003";
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('"+user+"','v55@example.test','V55','ACTIVE','VERIFIED','USER',now(),now()),('"+other+"','v55b@example.test','V55b','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('"+project+"','V55','v55','ACTIVE','MEDIUM','PRIVATE','"+user+"',now(),now())");
            sql.execute("INSERT INTO meetings(id,project_id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('"+meeting+"','"+project+"','"+user+"','Old meeting',now()+interval '1 day',now()+interval '2 days','Europe/Istanbul','SCHEDULED','v55-room',now(),now())");
            // V54-era queue rows in different states, one with an old error code.
            sql.execute("INSERT INTO meeting_reminder_deliveries(id,meeting_id,recipient_user_id,reminder_revision,reminder_at,next_attempt_at,created_at) VALUES (gen_random_uuid(),'"+meeting+"','"+user+"',0,now(),now(),now())");
            sql.execute("INSERT INTO meeting_reminder_deliveries(id,meeting_id,recipient_user_id,reminder_revision,reminder_at,status,error_code,next_attempt_at,created_at) VALUES (gen_random_uuid(),'"+meeting+"','"+other+"',0,now(),'CANCELLED','NO_LONGER_ELIGIBLE',now(),now())");

            var latest=Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("55").load();
            assertEquals(1,latest.migrate().migrationsExecuted,"only V55 is applied on top of V54");

            // The old meeting is intact and gets the default icon; the reminder revision and both queue rows are unchanged.
            try(var rows=sql.executeQuery("SELECT title,status,reminder_revision,icon FROM meetings")) { assertTrue(rows.next()); assertEquals("Old meeting",rows.getString(1)); assertEquals("SCHEDULED",rows.getString(2)); assertEquals(0,rows.getLong(3)); assertEquals("video",rows.getString(4)); assertFalse(rows.next()); }
            try(var rows=sql.executeQuery("SELECT status,error_code FROM meeting_reminder_deliveries ORDER BY status")) {
                assertTrue(rows.next()); assertEquals("CANCELLED",rows.getString(1)); assertEquals("NO_LONGER_ELIGIBLE",rows.getString(2));
                assertTrue(rows.next()); assertEquals("PENDING",rows.getString(1)); assertNull(rows.getString(2)); assertFalse(rows.next());
            }
            // The icon allowlist is a database rule, not only a service rule.
            assertEquals(1,sql.executeUpdate("UPDATE meetings SET icon='code'"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meetings SET icon='skull'"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meetings SET icon=NULL"));
            // The new skip reasons are accepted; anything else (for example an address) still is not, and the V54 rules still hold.
            for(String reason:new String[]{"RECIPIENT_UNAVAILABLE","NOT_A_PROJECT_MEMBER","PROJECT_UNAVAILABLE","REMOVED_FROM_MEETING"}) assertEquals(1,sql.executeUpdate("UPDATE meeting_reminder_deliveries SET status='CANCELLED',error_code='"+reason+"' WHERE recipient_user_id='"+user+"'"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meeting_reminder_deliveries SET error_code='user@email.test'"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meeting_reminder_deliveries SET attempts=9"));
            assertThrows(SQLException.class,()->sql.executeUpdate("INSERT INTO meeting_reminder_deliveries(id,meeting_id,recipient_user_id,reminder_revision,reminder_at,next_attempt_at,created_at) VALUES (gen_random_uuid(),'"+meeting+"','"+other+"',0,now(),now(),now())"),"(meeting,recipient,revision) stays unique");
            // Per-user history: one row per (meeting,user), cascades with the meeting or the user and never touches the meeting itself.
            assertEquals(1,sql.executeUpdate("INSERT INTO meeting_user_hidden(meeting_id,user_id,hidden_at) VALUES ('"+meeting+"','"+user+"',now())"));
            assertThrows(SQLException.class,()->sql.executeUpdate("INSERT INTO meeting_user_hidden(meeting_id,user_id,hidden_at) VALUES ('"+meeting+"','"+user+"',now())"));
            try(var rows=sql.executeQuery("SELECT count(*) FROM meetings")) { rows.next(); assertEquals(1,rows.getInt(1)); }
            latest.validate(); assertEquals(0,latest.migrate().migrationsExecuted,"idempotent startup");
            sql.executeUpdate("DELETE FROM meetings WHERE id='"+meeting+"'");
            for(String table:new String[]{"meeting_user_hidden","meeting_reminder_deliveries"}) try(var rows=sql.executeQuery("SELECT count(*) FROM "+table)) { rows.next(); assertEquals(0,rows.getInt(1),table+" cascades with the meeting"); }
        }
    }
}
