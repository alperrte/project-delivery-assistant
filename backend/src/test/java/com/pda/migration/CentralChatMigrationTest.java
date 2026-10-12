package com.pda.migration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.sql.DriverManager;
import java.sql.SQLException;
import static org.junit.jupiter.api.Assertions.*;
@Testcontainers(disabledWithoutDocker=true)
class CentralChatMigrationTest {
 @Container static PostgreSQLContainer postgres=new PostgreSQLContainer("postgres:18-alpine");
 @Test void duplicateDmMergeKeepsIdsRepliesReactionsReadEvidenceAndSurvivesProjectDeletion() throws Exception {
  var baseline=Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).locations("classpath:db/migration").target("42").load();baseline.migrate();
  try(var db=DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());var sql=db.createStatement()) {
   sql.execute("CREATE TEMP TABLE fixture AS SELECT gen_random_uuid() p1,gen_random_uuid() p2,gen_random_uuid() c1,gen_random_uuid() c2,gen_random_uuid() m1,gen_random_uuid() m2,gen_random_uuid() m3,'00000000-0000-0000-0000-000000000001'::uuid a,'00000000-0000-0000-0000-000000000002'::uuid b");
   sql.execute("INSERT INTO projects(id,name,slug,created_by,status,priority,visibility,created_at,updated_at) SELECT p1,'First','migration-first',a,'ACTIVE','MEDIUM','PRIVATE',now(),now() FROM fixture UNION ALL SELECT p2,'Second','migration-second',a,'ACTIVE','MEDIUM','PRIVATE',now(),now() FROM fixture");
   sql.execute("INSERT INTO chat_conversations(id,project_id,type,direct_user_low,direct_user_high,created_at) SELECT c1,p1,'DIRECT',a,b,now()-interval '2 day' FROM fixture UNION ALL SELECT c2,p2,'DIRECT',a,b,now()-interval '1 day' FROM fixture");
   sql.execute("INSERT INTO chat_messages(id,conversation_id,sender_user_id,content,created_at) SELECT m1,c1,a,'first',now()-interval '2 hour' FROM fixture UNION ALL SELECT m2,c2,a,'second',now()-interval '1 hour' FROM fixture");
   sql.execute("INSERT INTO chat_messages(id,conversation_id,sender_user_id,content,created_at,reply_to_message_id) SELECT m3,c2,b,'reply',now(),m2 FROM fixture");
   sql.execute("INSERT INTO chat_message_reactions(message_id,user_id,emoji_code,created_at) SELECT m2,b,'HEART',now() FROM fixture");
   sql.execute("INSERT INTO chat_read_states(conversation_id,user_id,last_read_at) SELECT c1,b,now() FROM fixture UNION ALL SELECT c2,b,now()-interval '2 hour' FROM fixture");
   sql.execute("ALTER TABLE fixture ADD COLUMN g uuid DEFAULT gen_random_uuid(),ADD COLUMN gm uuid DEFAULT gen_random_uuid()");
   sql.execute("INSERT INTO chat_conversations(id,project_id,type,created_at) SELECT g,p1,'PROJECT',now()-interval '2 day' FROM fixture");
   sql.execute("INSERT INTO chat_messages(id,conversation_id,sender_user_id,content,created_at) SELECT gm,g,a,'old group',now()-interval '2 hour' FROM fixture");
   sql.execute("INSERT INTO chat_read_states(conversation_id,user_id,last_read_at) SELECT g,b,now() FROM fixture");
   var latest=Flyway.configure().dataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword()).locations("classpath:db/migration").load();assertEquals(4,latest.migrate().migrationsExecuted);
   try(var r=sql.executeQuery("SELECT count(*),count(distinct conversation_id) FROM chat_messages WHERE conversation_id=(SELECT c1 FROM fixture)")){assertTrue(r.next());assertEquals(3,r.getInt(1));assertEquals(1,r.getInt(2));}
   try(var r=sql.executeQuery("SELECT m.reply_to_message_id=f.m2,m.conversation_id=f.c1 FROM chat_messages m CROSS JOIN fixture f WHERE m.id=f.m3")){assertTrue(r.next());assertTrue(r.getBoolean(1));assertTrue(r.getBoolean(2));}
   try(var r=sql.executeQuery("SELECT count(*) FROM chat_message_reactions")){assertTrue(r.next());assertEquals(1,r.getInt(1));}
   try(var r=sql.executeQuery("SELECT r.read_at IS NOT NULL FROM chat_message_receipts r CROSS JOIN fixture f WHERE r.message_id=f.m1 AND r.user_id=f.b")){assertTrue(r.next());assertTrue(r.getBoolean(1));}
   try(var r=sql.executeQuery("SELECT r.read_at IS NULL FROM chat_message_receipts r CROSS JOIN fixture f WHERE r.message_id=f.m2 AND r.user_id=f.b")){assertTrue(r.next());assertTrue(r.getBoolean(1));}
   try(var r=sql.executeQuery("SELECT r.read_at IS NOT NULL FROM chat_message_receipts r CROSS JOIN fixture f WHERE r.message_id=f.gm AND r.user_id=f.b")){assertTrue(r.next());assertTrue(r.getBoolean(1));}
   assertThrows(SQLException.class,()->sql.execute("INSERT INTO chat_conversations(id,type,direct_user_low,direct_user_high,created_at) SELECT gen_random_uuid(),'DIRECT',a,b,now() FROM fixture"));
   sql.execute("DELETE FROM projects");try(var r=sql.executeQuery("SELECT count(*) FROM chat_messages")){r.next();assertEquals(3,r.getInt(1));}
   latest.validate();assertEquals(0,latest.migrate().migrationsExecuted);
  }
 }
}
