package com.pda.notification;
import com.pda.BackendApplication;
import com.pda.meeting.MeetingEvents;
import com.pda.notification.application.*;
import com.pda.notification.domain.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.*;
import com.pda.shared.testing.TestPostgres;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
@SpringBootTest(classes=BackendApplication.class)
@Testcontainers
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
class MeetingNotificationIntegrationTest {
    @Container static TestPostgres postgres=new TestPostgres("postgres:17-alpine");
    static final byte[] JWT_KEY=new byte[32]; static {new SecureRandom().nextBytes(JWT_KEY);}
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){
        r.add("spring.datasource.url",postgres::getJdbcUrl);r.add("spring.datasource.username",postgres::getUsername);
        r.add("spring.datasource.password",postgres::getPassword);r.add("FRONTEND_URL",()->"http://localhost:3000");
        r.add("JWT_SECRET",()->Base64.getEncoder().encodeToString(JWT_KEY));
    }
    @Autowired JdbcTemplate db;
    @Autowired MeetingNotificationStore store;
    @Autowired NotificationService notifications;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired TransactionTemplate transaction;
    @Autowired IncompleteEventPublications publications;
    @Test void lifecycleFanoutReplayAndOwnReadFiltersPersist(){
        UUID a=account(),b=account(),outsider=account(),project=UUID.randomUUID(),meeting=UUID.randomUUID();
        for(var type:MeetingEvents.Type.values()){
            var e=event(meeting,project,type,Set.of(a,b));
            transaction.executeWithoutResult(s->publisher.publishEvent(e));store.save(e);store.save(e);
        }
        assertEquals(6,notifications.unreadCount(a));assertEquals(6,notifications.unreadCount(b));assertEquals(0,notifications.unreadCount(outsider));
        var page=notifications.list(a,true,null,project,List.of(NotificationType.MEETING_CREATED),0,20);
        assertEquals(1,page.getTotalElements());var n=page.getContent().getFirst();
        assertThrows(NoSuchElementException.class,()->notifications.markRead(outsider,n.getId()));
        var readAt=notifications.markRead(a,n.getId()).getReadAt();
        assertEquals(readAt,notifications.markRead(a,n.getId()).getReadAt());assertEquals(5,notifications.unreadCount(a));
        assertEquals(1,notifications.list(a,false,true,null,0,20).getTotalElements());
        assertEquals(6,notifications.list(a,false,null,0,20).getTotalElements());assertTrue(notifications.claimTeamDeletion(a).isEmpty());
    }
    @Test void rollbackPublishesNothing(){
        var e=event(UUID.randomUUID(),UUID.randomUUID(),MeetingEvents.Type.CREATED,Set.of(account()));
        assertThrows(IllegalStateException.class,()->transaction.executeWithoutResult(s->{publisher.publishEvent(e);throw new IllegalStateException("TEST-ONLY rollback");}));
        assertEquals(0,count(e.eventId()));
    }
    @Test void failedFanoutIsAtomicAndDurableReplayRecovers(){
        UUID a=account(),missing=UUID.randomUUID();var e=event(UUID.randomUUID(),UUID.randomUUID(),MeetingEvents.Type.OPENED,Set.of(a,missing));
        try{transaction.executeWithoutResult(s->publisher.publishEvent(e));}catch(RuntimeException expected){ }
        assertEquals(0,count(e.eventId()));account(missing);
        publications.resubmitIncompletePublications(p->p.getEvent() instanceof MeetingEvents.Changed x && x.eventId().equals(e.eventId()));
        assertEquals(2,count(e.eventId()));store.save(e);assertEquals(2,count(e.eventId()));
    }
    @Test void batchBoundaryRetainsEveryRecipient(){
        Set<UUID> recipients=new HashSet<>();List<Object[]> accounts=new ArrayList<>();
        for(int i=0;i<501;i++){UUID id=UUID.randomUUID();recipients.add(id);accounts.add(new Object[]{id,id+"@example.test",id.toString().substring(0,20)});}
        db.batchUpdate("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES (?,?,?,'ACTIVE','VERIFIED','USER',now(),now())",accounts);
        var e=event(UUID.randomUUID(),UUID.randomUUID(),MeetingEvents.Type.OVERTIME,recipients);store.save(e);store.save(e);assertEquals(501,count(e.eventId()));
    }
    @Test void constraintsPreserveOtherFamiliesAndRequireMeetingEvent(){
        UUID user=account();
        for(String type:List.of("MEETING_CREATED","TASK_ASSIGNED","SQUAD_DELETED")){
            String resource=type.startsWith("MEETING")?"MEETING":type.startsWith("TASK")?"TASK":"SQUAD";
            UUID source=type.startsWith("MEETING")?null:UUID.randomUUID();
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->db.update("INSERT INTO notifications(id,recipient_user_id,type,title,message,is_read,created_at,resource_type,resource_id,source_event_id) VALUES (?,?,?,'Title','Message',false,now(),?,?,?)",UUID.randomUUID(),user,type,resource,UUID.randomUUID(),source));
        }
    }
    private long count(UUID e){return db.queryForObject("SELECT count(*) FROM notifications WHERE source_event_id=?",Long.class,e);}
    private MeetingEvents.Changed event(UUID meeting,UUID project,MeetingEvents.Type type,Set<UUID> users){return new MeetingEvents.Changed(UUID.randomUUID(),meeting,project,null,type,"Meeting",users,Instant.now());}
    private UUID account(){UUID id=UUID.randomUUID();account(id);return id;}
    private void account(UUID id){db.update("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) VALUES (?,?,?,'ACTIVE','VERIFIED','USER',now(),now())",id,id+"@example.test",id.toString().substring(0,20));}
}
