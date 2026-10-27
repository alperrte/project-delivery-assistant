package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.sql.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * V57 on top of a real V56 database: meetings that belonged to a project become user-owned without losing a record, an organizer,
 * an attendee or a participant, and deleting a project can no longer delete a meeting.
 */
@Testcontainers
class MeetingV57MigrationTest {
    @Container static PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:18-alpine");
    static final String OWNER="00000000-0000-0000-0000-000000000001",MEMBER="00000000-0000-0000-0000-000000000002",REMOVED="00000000-0000-0000-0000-000000000003",
        LEFT="00000000-0000-0000-0000-000000000004",INVITED="00000000-0000-0000-0000-000000000005",STRANGER="00000000-0000-0000-0000-000000000006";
    static final String PROJECT="00000000-0000-0000-0000-0000000000f1";
    static final String SCHEDULED="00000000-0000-0000-0000-0000000000a1",ENDED="00000000-0000-0000-0000-0000000000a2";

    static void user(Statement sql,String id,String nickname) throws SQLException {
        sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('"+id+"','"+nickname+"@example.test','"+nickname+"','ACTIVE','VERIFIED','USER',now(),now())");
    }
    static Set<String> attendees(Statement sql,String meeting) throws SQLException {
        Set<String> found=new TreeSet<>();
        try(var rows=sql.executeQuery("SELECT user_id FROM meeting_attendees WHERE meeting_id='"+meeting+"'")) { while(rows.next()) found.add(rows.getString(1)); }
        return found;
    }

    @Test void v57KeepsEveryMeetingOwnerAndPersonAndDetachesMeetingsFromProjects() throws Exception {
        String url=postgres.getJdbcUrl(),name=postgres.getUsername(),password=postgres.getPassword();
        Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("56").load().migrate();
        try(var connection=DriverManager.getConnection(url,name,password);var sql=connection.createStatement()) {
            for(String[] account:new String[][]{{OWNER,"owner"},{MEMBER,"member"},{REMOVED,"removed"},{LEFT,"left"},{INVITED,"invited"},{STRANGER,"stranger"}}) user(sql,account[0],account[1]);
            sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('"+PROJECT+"','Legacy','legacy','ACTIVE','MEDIUM','PRIVATE','"+OWNER+"',now(),now())");
            sql.execute("INSERT INTO project_memberships(id,project_id,user_id,joined_at,status) VALUES (gen_random_uuid(),'"+PROJECT+"','"+OWNER+"',now(),'ACTIVE'),"
                +"(gen_random_uuid(),'"+PROJECT+"','"+MEMBER+"',now(),'ACTIVE'),(gen_random_uuid(),'"+PROJECT+"','"+REMOVED+"',now(),'REMOVED')");
            for(String[] meeting:new String[][]{{SCHEDULED,"SCHEDULED","room-1"},{ENDED,"ENDED","room-2"}})
                sql.execute("INSERT INTO meetings(id,project_id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('"+meeting[0]+"','"+PROJECT+"','"+OWNER+"','Old "+meeting[2]+"',now()+interval '1 day',now()+interval '2 days','Europe/Istanbul','"+meeting[1]+"','"+meeting[2]+"',now(),now())");
            sql.execute("INSERT INTO meeting_attendees(meeting_id,user_id) VALUES ('"+SCHEDULED+"','"+INVITED+"')");
            // Somebody who attended the finished meeting but is no longer in the project.
            sql.execute("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name) VALUES (gen_random_uuid(),'"+ENDED+"','"+LEFT+"','user-left','Left')");
            sql.execute("INSERT INTO meeting_chat_messages(id,meeting_id,participant_id,display_name,content,sent_at) SELECT gen_random_uuid(),meeting_id,id,'Left','old words',now() FROM meeting_participants WHERE identity='user-left'");
            // A meeting notification written before V57 carries its project.
            sql.execute("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,actor_user_id,project_id,resource_type,resource_id,source_event_id) "
                +"VALUES (gen_random_uuid(),'"+MEMBER+"','MEETING_CREATED','Meeting created','Meeting created: Old',false,now(),'"+OWNER+"','"+PROJECT+"','MEETING','"+SCHEDULED+"',gen_random_uuid())");

            var latest=Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("57").load();
            assertEquals(1,latest.migrate().migrationsExecuted,"only V57 is applied on top of V56");

            // Everyone who could reach a meeting through its project keeps access as an explicit attendee; nobody is duplicated or invented.
            assertEquals(Set.of(MEMBER,INVITED),attendees(sql,SCHEDULED),"active project members plus the people already invited; not the organizer, not a removed member");
            assertEquals(Set.of(MEMBER,LEFT),attendees(sql,ENDED),"active members plus a past participant who has since left the project");
            // Owners, titles, chat and the old notification are untouched.
            try(var rows=sql.executeQuery("SELECT count(*) FROM meetings WHERE organizer_id='"+OWNER+"'")) { rows.next(); assertEquals(2,rows.getInt(1)); }
            try(var rows=sql.executeQuery("SELECT count(*) FROM meeting_chat_messages")) { rows.next(); assertEquals(1,rows.getInt(1)); }
            try(var rows=sql.executeQuery("SELECT project_id FROM notifications WHERE type='MEETING_CREATED'")) { rows.next(); assertEquals(PROJECT,rows.getString(1)); }
            try(var rows=sql.executeQuery("SELECT project_id FROM meetings WHERE id='"+SCHEDULED+"'")) { rows.next(); assertEquals(PROJECT,rows.getString(1),"the legacy column is kept for one release"); }

            // New meetings need no project, and a meeting notification needs none either.
            sql.execute("INSERT INTO meetings(id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('00000000-0000-0000-0000-0000000000a3','"+STRANGER+"','Global',now()+interval '1 day',now()+interval '2 days','UTC','SCHEDULED','room-3',now(),now())");
            sql.execute("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,actor_user_id,resource_type,resource_id,source_event_id) "
                +"VALUES (gen_random_uuid(),'"+STRANGER+"','MEETING_CREATED','Meeting created','Meeting created: Global',false,now(),'"+STRANGER+"','MEETING','00000000-0000-0000-0000-0000000000a3',gen_random_uuid())");
            // The meeting-event invariants still hold: a meeting notification must still come from an event.
            assertThrows(SQLException.class,()->sql.execute("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,resource_type,resource_id) VALUES (gen_random_uuid(),'"+STRANGER+"','MEETING_CREATED','t','m',false,now(),'MEETING',gen_random_uuid())"));

            // Deleting the project no longer deletes any meeting; it only forgets the legacy link.
            sql.execute("DELETE FROM projects WHERE id='"+PROJECT+"'");
            try(var rows=sql.executeQuery("SELECT count(*), count(project_id) FROM meetings")) { rows.next(); assertEquals(3,rows.getInt(1),"all three meetings survive"); assertEquals(0,rows.getInt(2),"no meeting points at a project any more"); }
            assertEquals(Set.of(MEMBER,INVITED),attendees(sql,SCHEDULED),"attendance is independent of the deleted project");
            try(var rows=sql.executeQuery("SELECT count(*) FROM meeting_participants")) { rows.next(); assertEquals(1,rows.getInt(1)); }

            latest.validate(); assertEquals(0,latest.migrate().migrationsExecuted,"idempotent startup");
        }
    }
}
