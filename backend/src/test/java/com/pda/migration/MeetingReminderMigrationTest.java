package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.*;
import com.pda.shared.testing.TestPostgres;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class MeetingReminderMigrationTest {
    @Container static TestPostgres postgres=new TestPostgres("postgres:18-alpine");
    @Test void v54PreservesOldMeetingsAndEnforcesDeliveryIdentityAndState() throws Exception {
        Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())
                .locations("classpath:db/migration").target("53").load().migrate();
        try(var connection=DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());var sql=connection.createStatement()) {
            String user="00000000-0000-0000-0000-000000000001",project="00000000-0000-0000-0000-000000000002",meeting="00000000-0000-0000-0000-000000000003";
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('"+user+"','migration@example.test','Migration','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('"+project+"','Migration','migration','ACTIVE','MEDIUM','PRIVATE','"+user+"',now(),now())");
            sql.execute("INSERT INTO meetings(id,project_id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('"+meeting+"','"+project+"','"+user+"','Old meeting',now()+interval '1 day',now()+interval '2 days','Europe/Istanbul','SCHEDULED','migration-room',now(),now())");
            var latest=Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).locations("classpath:db/migration").target("54").load();
            assertEquals(1,latest.migrate().migrationsExecuted);
            try(var rows=sql.executeQuery("SELECT title,status,reminder_revision FROM meetings")) { assertTrue(rows.next()); assertEquals("Old meeting",rows.getString(1)); assertEquals("SCHEDULED",rows.getString(2)); assertEquals(0,rows.getLong(3)); }
            String insert="INSERT INTO meeting_reminder_deliveries(id,meeting_id,recipient_user_id,reminder_revision,reminder_at,next_attempt_at,created_at) VALUES (gen_random_uuid(),'"+meeting+"','"+user+"',0,now(),now(),now())";
            assertEquals(1,sql.executeUpdate(insert)); assertThrows(SQLException.class,()->sql.executeUpdate(insert));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meeting_reminder_deliveries SET attempts=9"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meeting_reminder_deliveries SET status='SENT'"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meeting_reminder_deliveries SET status='SENDING'"));
            assertThrows(SQLException.class,()->sql.executeUpdate("UPDATE meeting_reminder_deliveries SET error_code='user@email.test'"));
            try(var rows=sql.executeQuery("SELECT column_name FROM information_schema.columns WHERE table_name='meeting_reminder_deliveries'")) {
                while(rows.next()) { assertFalse(rows.getString(1).contains("email")); assertFalse(rows.getString(1).contains("body")); }
            }
            latest.validate(); assertEquals(0,latest.migrate().migrationsExecuted);
            sql.executeUpdate("DELETE FROM meetings WHERE id='"+meeting+"'");
            try(var rows=sql.executeQuery("SELECT count(*) FROM meeting_reminder_deliveries")) { rows.next(); assertEquals(0,rows.getInt(1)); }
        }
    }
}
