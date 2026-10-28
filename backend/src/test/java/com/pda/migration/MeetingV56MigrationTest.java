package com.pda.migration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.*;
import com.pda.shared.testing.TestPostgres;
import java.sql.*;
import static org.junit.jupiter.api.Assertions.*;

/** V56 on top of a real V55 database: old chat messages survive, replies are tied to one meeting, reactions are one per person and emoji. */
@Testcontainers
class MeetingV56MigrationTest {
    @Container static TestPostgres postgres=new TestPostgres("postgres:18-alpine");
    @Test void v56KeepsOldChatAndAddsSameMeetingRepliesAndReactions() throws Exception {
        String url=postgres.getJdbcUrl(),name=postgres.getUsername(),password=postgres.getPassword();
        Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("55").load().migrate();
        try(var connection=DriverManager.getConnection(url,name,password);var sql=connection.createStatement()) {
            String user="00000000-0000-0000-0000-000000000001",project="00000000-0000-0000-0000-000000000002";
            String m1="00000000-0000-0000-0000-0000000000a1",m2="00000000-0000-0000-0000-0000000000a2",p1="00000000-0000-0000-0000-0000000000b1",p2="00000000-0000-0000-0000-0000000000b2";
            String old="00000000-0000-0000-0000-0000000000c1";
            sql.execute("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES ('"+user+"','v56@example.test','V56','ACTIVE','VERIFIED','USER',now(),now())");
            sql.execute("INSERT INTO projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) VALUES ('"+project+"','V56','v56','ACTIVE','MEDIUM','PRIVATE','"+user+"',now(),now())");
            for(String[] meeting:new String[][]{{m1,"room-1"},{m2,"room-2"}})
                sql.execute("INSERT INTO meetings(id,project_id,organizer_id,title,starts_at,ends_at,zone_id,status,room_name,created_at,updated_at) VALUES ('"+meeting[0]+"','"+project+"','"+user+"','Meeting "+meeting[1]+"',now()+interval '1 day',now()+interval '2 days','Europe/Istanbul','SCHEDULED','"+meeting[1]+"',now(),now())");
            sql.execute("INSERT INTO meeting_participants(id,meeting_id,user_id,identity,display_name) VALUES ('"+p1+"','"+m1+"','"+user+"','user-1','One'),('"+p2+"','"+m2+"','"+user+"','user-2','Two')");
            sql.execute("INSERT INTO meeting_chat_messages(id,meeting_id,participant_id,display_name,content,sent_at) VALUES ('"+old+"','"+m1+"','"+p1+"','One','written before V56',now())");

            var latest=Flyway.configure().dataSource(url,name,password).locations("classpath:db/migration").target("56").load();
            assertEquals(1,latest.migrate().migrationsExecuted,"only V56 is applied on top of V55");

            // The old message is untouched and simply has no reply.
            try(var rows=sql.executeQuery("SELECT content,reply_to_message_id FROM meeting_chat_messages")) { assertTrue(rows.next()); assertEquals("written before V56",rows.getString(1)); assertNull(rows.getObject(2)); assertFalse(rows.next()); }
            // A reply in the same meeting works; to another meeting, or to itself, is refused by the database.
            String insert="INSERT INTO meeting_chat_messages(id,meeting_id,participant_id,display_name,content,sent_at,reply_to_message_id) VALUES ('%s','%s','%s','One','answer',now(),%s)";
            String reply="00000000-0000-0000-0000-0000000000c2";
            assertEquals(1,sql.executeUpdate(insert.formatted(reply,m1,p1,"'"+old+"'")));
            assertThrows(SQLException.class,()->sql.executeUpdate(insert.formatted("00000000-0000-0000-0000-0000000000c3",m2,p2,"'"+old+"'")),"another meeting");
            assertThrows(SQLException.class,()->sql.executeUpdate(insert.formatted("00000000-0000-0000-0000-0000000000c4",m1,p1,"'00000000-0000-0000-0000-0000000000c4'")),"itself");
            // Reactions: one row per (message, participant, emoji); a second identical one is refused, another emoji or person is fine.
            String react="INSERT INTO meeting_chat_reactions(message_id,participant_id,emoji,created_at) VALUES ('"+old+"','"+p1+"','%s',now())";
            assertEquals(1,sql.executeUpdate(react.formatted("👍"))); assertEquals(1,sql.executeUpdate(react.formatted("❤️")));
            assertThrows(SQLException.class,()->sql.executeUpdate(react.formatted("👍")),"same person and emoji twice");
            assertThrows(SQLException.class,()->sql.executeUpdate(react.formatted("")),"empty emoji");
            assertThrows(SQLException.class,()->sql.executeUpdate(react.formatted("x".repeat(33))),"too long");
            // Deleting the answered message keeps the reply and clears only the link (the meeting column stays); its reactions go with it.
            sql.executeUpdate("DELETE FROM meeting_chat_messages WHERE id='"+old+"'");
            try(var rows=sql.executeQuery("SELECT reply_to_message_id,meeting_id FROM meeting_chat_messages WHERE id='"+reply+"'")) { assertTrue(rows.next()); assertNull(rows.getObject(1)); assertEquals(m1,rows.getString(2)); }
            try(var rows=sql.executeQuery("SELECT count(*) FROM meeting_chat_reactions")) { rows.next(); assertEquals(0,rows.getInt(1)); }
            latest.validate(); assertEquals(0,latest.migrate().migrationsExecuted,"idempotent startup");
            // The older V54/V55 data (reminder queue, icon) is not touched by V56.
            try(var rows=sql.executeQuery("SELECT icon FROM meetings")) { while(rows.next()) assertEquals("video",rows.getString(1)); }
        }
    }
}
