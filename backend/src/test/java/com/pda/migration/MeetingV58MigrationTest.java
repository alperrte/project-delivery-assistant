package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * V58 on top of a real V57 database. Meetings that V57 made global (they still carry the project they once belonged to in the retired
 * project_id column) must stay INDEPENDENT: that stale value may never become a live project link. It is kept for the record in
 * legacy_project_id. New project meetings link to a project that, when deleted, turns them into independent meetings instead of deleting them.
 */
@Testcontainers
class MeetingV58MigrationTest {
    @Container static PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:18-alpine");
    static final String OWNER="00000000-0000-0000-0000-000000000001",ATTENDEE="00000000-0000-0000-0000-000000000002",OLD_PROJECT="00000000-0000-0000-0000-0000000000f1",NEW_PROJECT="00000000-0000-0000-0000-0000000000f2";
    static final String OLD="00000000-0000-0000-0000-0000000000a1",OLD_GONE="00000000-0000-0000-0000-0000000000a2",PROJECT_MEETING="00000000-0000-0000-0000-0000000000a3",SOLO="00000000-0000-0000-0000-0000000000a4";

    private static String one(Statement sql,String query) throws SQLException { try(var rows=sql.executeQuery(query)) { rows.next(); return rows.getString(1); } }
    private static void meeting(Statement sql,String id,String project,String room) throws SQLException {
        sql.execute("INSERT INTO meetings(id,"+(project==null?"":"project_id,")+"organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('"+id+"',"+(project==null?"":"'"+project+"',")+"'"+OWNER+"','M "+room+"',now()+interval '1 day',now()+interval '2 days','UTC','SCHEDULED','"+room+"',now(),now())");
    }

    @Test void v58KeepsGlobalMeetingsIndependentArchivesTheOldProjectAndMakesProjectLinksSafe() throws Exception {
        String url=postgres.getJdbcUrl(),name=postgres.getUsername(),password=postgres.getPassword();
        Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("57").load().migrate();
        try(var connection=DriverManager.getConnection(url,name,password);var sql=connection.createStatement()) {
            for(String[] user:new String[][]{{OWNER,"owner"},{ATTENDEE,"attendee"}})
                sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('"+user[0]+"','"+user[1]+"@example.test','"+user[1]+"','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('"+OLD_PROJECT+"','Old','old','ACTIVE','MEDIUM','PRIVATE','"+OWNER+"',now(),now()),('"+NEW_PROJECT+"','New','new','ACTIVE','MEDIUM','PRIVATE','"+OWNER+"',now(),now())");
            // State right after V57: meetings that were project-owned keep the stale value (one project is already gone: the FK nulled it), one never had a project.
            meeting(sql,OLD,OLD_PROJECT,"r1"); meeting(sql,OLD_GONE,null,"r2"); meeting(sql,SOLO,null,"r4");
            sql.execute("INSERT INTO meeting_attendees(meeting_id,user_id) VALUES ('"+OLD+"','"+ATTENDEE+"')");
            sql.execute("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name) VALUES (gen_random_uuid(),'"+OLD+"','"+ATTENDEE+"','user-a','A')");

            var latest=Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("58").load();
            assertEquals(1,latest.migrate().migrationsExecuted,"only V58 is applied on top of V57");

            // Every pre-existing meeting is independent: no live project link, the old value is archived, nothing else changed.
            assertEquals("0",one(sql,"SELECT count(project_id) FROM meetings"),"no existing meeting becomes a project meeting");
            assertEquals(OLD_PROJECT,one(sql,"SELECT legacy_project_id FROM meetings WHERE id='"+OLD+"'"),"the old value is kept for the record");
            assertEquals("3",one(sql,"SELECT count(*) FROM meetings")); assertEquals(ATTENDEE,one(sql,"SELECT user_id FROM meeting_attendees WHERE meeting_id='"+OLD+"'"));
            assertEquals("1",one(sql,"SELECT count(*) FROM meeting_participants")); assertEquals(OWNER,one(sql,"SELECT organizer_id FROM meetings WHERE id='"+OLD+"'"));
            // The archive is not a link: deleting that old project touches nothing (no foreign key left on it).
            sql.execute("DELETE FROM projects WHERE id='"+OLD_PROJECT+"'");
            assertEquals("3",one(sql,"SELECT count(*) FROM meetings")); assertEquals(OLD_PROJECT,one(sql,"SELECT legacy_project_id FROM meetings WHERE id='"+OLD+"'"));

            // A real project meeting links to an existing project only, and a deleted project leaves an independent meeting behind.
            meeting(sql,PROJECT_MEETING,NEW_PROJECT,"r3");
            assertEquals(NEW_PROJECT,one(sql,"SELECT project_id FROM meetings WHERE id='"+PROJECT_MEETING+"'"));
            assertThrows(SQLException.class,()->meeting(sql,"00000000-0000-0000-0000-0000000000a9","00000000-0000-0000-0000-0000000000ee","r9"),"a project that does not exist cannot be linked");
            sql.execute("DELETE FROM projects WHERE id='"+NEW_PROJECT+"'");
            assertEquals("1",one(sql,"SELECT count(*) FROM meetings WHERE id='"+PROJECT_MEETING+"' AND project_id IS NULL"),"the meeting survives, now independent");
            assertEquals("4",one(sql,"SELECT count(*) FROM meetings"));

            latest.validate(); assertEquals(0,latest.migrate().migrationsExecuted,"idempotent startup");
        }
    }
}
