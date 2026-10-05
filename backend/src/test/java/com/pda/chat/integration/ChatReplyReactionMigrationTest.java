package com.pda.chat.integration;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@Testcontainers
class ChatReplyReactionMigrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @Test void preservesHistoryAndEnforcesReplyScopeAndReactionIdentity() {
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()).target("54").load().migrate();
        JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
        UUID project = UUID.randomUUID(), actor = UUID.randomUUID(), conversation = UUID.randomUUID(), other = UUID.randomUUID();
        db.update("insert into projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) values (?,'Legacy','chat-legacy','PLANNING','MEDIUM','PRIVATE',?,now(),now())",project,actor);
        for(UUID id : new UUID[]{conversation,other}) {
            // Different projects allow two PROJECT conversations and also prove the transitive project boundary.
            UUID pid = id.equals(conversation) ? project : UUID.randomUUID();
            if(!pid.equals(project)) db.update("insert into projects(id,name,slug,status,priority,visibility,created_by,created_at,updated_at) values (?,'Other','chat-other','PLANNING','MEDIUM','PRIVATE',?,now(),now())",pid,actor);
            db.update("insert into chat_conversations(id,project_id,type,created_at) values (?,?,'PROJECT',now())",id,pid);
        }
        UUID legacy = UUID.randomUUID(), foreign = UUID.randomUUID();
        insert(db,legacy,conversation,actor,"😂❤️ legacy"); insert(db,foreign,other,actor,"Foreign");
        Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).load().migrate();
        assertEquals("😂❤️ legacy",db.queryForObject("select content from chat_messages where id=?",String.class,legacy));
        assertNull(db.queryForObject("select reply_to_message_id from chat_messages where id=?",UUID.class,legacy));
        assertEquals(0L,db.queryForObject("select reaction_version from chat_messages where id=?",Long.class,legacy));
        UUID reply=UUID.randomUUID(); insert(db,reply,conversation,actor,"Reply");
        db.update("update chat_messages set reply_to_message_id=? where id=?",legacy,reply);
        assertEquals(legacy,db.queryForObject("select reply_to_message_id from chat_messages where id=?",UUID.class,reply));
        assertThrows(DataIntegrityViolationException.class,()->db.update("update chat_messages set reply_to_message_id=? where id=?",foreign,reply));
        assertThrows(DataIntegrityViolationException.class,()->db.update("update chat_messages set reply_to_message_id=id where id=?",reply));
        assertThrows(DataIntegrityViolationException.class,()->db.update("update chat_messages set reaction_version=-1 where id=?",legacy));
        db.update("insert into chat_message_reactions values (?,?,'THUMBS_UP',now())",legacy,actor);
        assertThrows(DataIntegrityViolationException.class,()->db.update("insert into chat_message_reactions values (?,?,'THUMBS_UP',now())",legacy,actor));
        db.update("insert into chat_message_reactions values (?,?,'HEART',now())",legacy,actor);
        assertEquals(2,db.queryForObject("select count(*) from chat_message_reactions where message_id=?",Integer.class,legacy));
        assertThrows(DataIntegrityViolationException.class,()->db.update("insert into chat_message_reactions values (?,?,'INVALID',now())",legacy,actor));
        assertThrows(DataIntegrityViolationException.class,()->db.update("delete from chat_messages where id=?",legacy));
        UUID deletable=UUID.randomUUID(); insert(db,deletable,conversation,actor,"cleanup");
        db.update("insert into chat_message_reactions values (?,?,'LAUGH',now())",deletable,actor);
        db.update("delete from chat_messages where id=?",deletable);
        assertEquals(0,db.queryForObject("select count(*) from chat_message_reactions where message_id=?",Integer.class,deletable));
    }
    private void insert(JdbcTemplate db,UUID id,UUID conversation,UUID actor,String content) {
        db.update("insert into chat_messages(id,conversation_id,sender_user_id,content,created_at) values (?,?,?,?,now())",id,conversation,actor,content);
    }
}
