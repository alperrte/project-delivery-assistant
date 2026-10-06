package com.pda.notification;

import com.pda.BackendApplication;
import com.pda.notification.application.*;
import com.pda.notification.domain.*;
import com.pda.notification.infrastructure.NotificationRepository;
import com.pda.project.application.service.*;
import com.pda.squad.SquadLifecycleEvents.TeamDeleted;
import com.pda.squad.application.service.SquadService;
import com.pda.user.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.IncompleteEventPublications;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TeamDeletionNotificationIntegrationTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
    static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("FRONTEND_URL", () -> "http://localhost:3000");
        r.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }
    @Autowired UserAccounts users;
    @Autowired ProjectService projects;
    @Autowired ProjectMembershipService memberships;
    @Autowired SquadService squads;
    @Autowired NotificationService service;
    @Autowired NotificationRepository rows;
    @Autowired NotificationFactory factory;
    @Autowired JdbcTemplate db;
    @Autowired TransactionTemplate transaction;
    @Autowired IncompleteEventPublications publications;
    @Autowired MockMvc mvc;
    @MockitoSpyBean TeamDeletionNotificationStore store;

    @Test void committedDeletePersistsForTwoMembersAndActorGetsNoDeletionNotification() throws Exception {
        Fixture f = fixture(); squads.deleteTeam(f.actor.id, f.project, f.team);
        assertEquals(1L, count(f.team, f.a.id)); assertEquals(1L, count(f.team, f.b.id));
        assertEquals(0L, count(f.team, f.actor.id));
        var n = ownDeletion(f.a.id, f.team);
        assertEquals("Delete target", n.getTeamDeletion().teamName());
        assertEquals(f.actor.id, n.getActorUserId());
        assertEquals(f.project, n.getProjectId());
        assertNull(n.getStatusChange()); assertFalse(n.isRead()); assertNull(n.getPopupPresentedAt());
        mvc.perform(get("/api/v1/notifications?type=SQUAD_DELETED").cookie(f.a.access))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].teamDeletion.teamName").value("Delete target"));
        mvc.perform(get("/api/v1/notifications?type=SQUAD_DELETED").cookie(f.actor.access))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test void rollbackAndDuplicateDeleteProduceNoExtraNotification() throws Exception {
        Fixture f = fixture();
        assertThrows(IllegalStateException.class, () -> transaction.execute(status -> {
            squads.deleteTeam(f.actor.id, f.project, f.team);
            throw new IllegalStateException("TEST-ONLY rollback");
        }));
        assertEquals(0L, count(f.team, f.a.id));
        squads.deleteTeam(f.actor.id, f.project, f.team);
        assertThrows(NoSuchElementException.class, () -> squads.deleteTeam(f.actor.id, f.project, f.team));
        assertEquals(1L, count(f.team, f.a.id)); assertEquals(1L, count(f.team, f.b.id));
    }

    @Test void ownClaimIsAtomicPersistsAcrossRequestsAndDoesNotMarkRead() throws Exception {
        Fixture f = fixture(); squads.deleteTeam(f.actor.id, f.project, f.team);
        long unread = service.unreadCount(f.a.id);
        Cookie csrf = csrf(); String path = "/api/v1/notifications/team-deletions/claim";
        mvc.perform(post(path).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isUnauthorized());
        mvc.perform(post(path).cookie(f.a.access)).andExpect(status().isForbidden());
        mvc.perform(post(path).cookie(f.a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actorId\":\"" + f.b.id + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path).cookie(f.actor.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(post(path).cookie(f.a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.read").value(false))
                .andExpect(jsonPath("$.popupPresentedAt").isNotEmpty())
                .andExpect(jsonPath("$.teamDeletion.teamName").value("Delete target"));
        mvc.perform(post(path).cookie(f.a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        assertEquals(unread, service.unreadCount(f.a.id));
        assertNotNull(ownDeletion(f.a.id, f.team).getPopupPresentedAt());
        assertNotNull(service.claimTeamDeletion(f.b.id).orElseThrow());
        assertTrue(service.claimTeamDeletion(f.b.id).isEmpty());
    }

    @Test void concurrentTabsCannotClaimTheSameNotificationAndReadBeforeClaimSuppressesPopup() throws Exception {
        Fixture f = fixture(); squads.deleteTeam(f.actor.id, f.project, f.team);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            Callable<Optional<Notification>> claim = () -> { assertTrue(start.await(10, TimeUnit.SECONDS)); return service.claimTeamDeletion(f.a.id); };
            var first = pool.submit(claim); var second = pool.submit(claim); start.countDown();
            var one = first.get(15, TimeUnit.SECONDS); var two = second.get(15, TimeUnit.SECONDS);
            assertEquals(1, (one.isPresent() ? 1 : 0) + (two.isPresent() ? 1 : 0));
            var b = ownDeletion(f.b.id, f.team); service.markRead(f.b.id, b.getId());
            assertTrue(service.claimTeamDeletion(f.b.id).isEmpty());
            assertEquals(1L, count(f.team, f.b.id));
        } finally { start.countDown(); pool.shutdownNow(); }
    }

    @Test void staleJpaReadMutationNeverErasesTheCommittedPresentationMarker() throws Exception {
        Fixture f = fixture(); squads.deleteTeam(f.actor.id, f.project, f.team);
        UUID id = ownDeletion(f.a.id, f.team).getId();
        ExecutorService pool = Executors.newSingleThreadExecutor();
        CountDownLatch loaded = new CountDownLatch(1), claimed = new CountDownLatch(1);
        try {
            var read = pool.submit(() -> transaction.execute(status -> {
                var n = rows.findByIdAndRecipientUserId(id, f.a.id).orElseThrow();
                assertNull(n.getPopupPresentedAt()); loaded.countDown();
                try { assertTrue(claimed.await(10, TimeUnit.SECONDS)); }
                catch (InterruptedException e) { throw new IllegalStateException(e); }
                n.markRead(); rows.saveAndFlush(n); return true;
            }));
            assertTrue(loaded.await(10, TimeUnit.SECONDS));
            try { assertTrue(service.claimTeamDeletion(f.a.id).isPresent()); } finally { claimed.countDown(); }
            assertTrue(read.get(15, TimeUnit.SECONDS));
            var restored = rows.findByIdAndRecipientUserId(id, f.a.id).orElseThrow();
            assertNotNull(restored.getPopupPresentedAt()); assertTrue(restored.isRead());
            assertEquals("Delete target", restored.getTeamDeletion().teamName());
        } finally { claimed.countDown(); pool.shutdownNow(); }
    }

    @Test void failedAfterCommitFanoutRollsBackPartialWritesAndRegistryReplayDeduplicates() throws Exception {
        Fixture f = fixture();
        // TEST-ONLY writer failure after an actual DB insert inside its REQUIRES_NEW transaction.
        doAnswer(call -> {
            TeamDeleted event = call.getArgument(0);
            UUID recipient = event.recipientIds().iterator().next();
            rows.saveAndFlush(factory.teamDeleted(recipient, event.deletedBy(), event.projectId(), event.teamId(),
                    event.eventId(), new TeamDeletion(event.projectName(), event.teamName(), event.actorNickname(), event.occurredAt())));
            throw new IllegalStateException("TEST-ONLY partial writer failure");
        }).when(store).save(any(TeamDeleted.class));
        try {
            try { squads.deleteTeam(f.actor.id, f.project, f.team); } catch (RuntimeException expectedAfterCommitFailure) { /* persisted deletion checked below */ }
            assertNotNull(db.queryForObject("SELECT archived_at FROM squads WHERE id=?", java.sql.Timestamp.class, f.team));
            assertEquals(0L, count(f.team, f.a.id)); assertEquals(0L, count(f.team, f.b.id));
            doCallRealMethod().when(store).save(any(TeamDeleted.class));
            publications.resubmitIncompletePublications(p -> p.getEvent() instanceof TeamDeleted e && e.teamId().equals(f.team));
            assertEquals(1L, count(f.team, f.a.id)); assertEquals(1L, count(f.team, f.b.id));
            Notification n = ownDeletion(f.a.id, f.team);
            var event = new TeamDeleted(n.getSourceEventId(), f.project, n.getTeamDeletion().projectName(), f.team,
                    n.getTeamDeletion().teamName(), f.actor.id, n.getTeamDeletion().actorNickname(),
                    Set.of(f.a.id, f.b.id, f.actor.id), n.getTeamDeletion().occurredAt());
            store.save(event); store.save(event);
            assertEquals(1L, count(f.team, f.a.id)); assertEquals(0L, count(f.team, f.actor.id));
        } finally { doCallRealMethod().when(store).save(any(TeamDeleted.class)); }
    }

    @Test void oldestClaimDoesNotDependOnTheFirstTwentyHistoryRows() throws Exception {
        Fixture f = fixture(); squads.deleteTeam(f.actor.id, f.project, f.team);
        UUID first = ownDeletion(f.a.id, f.team).getId();
        for (int i = 0; i < 20; i++) {
            UUID team = squads.create(f.actor.id, f.project, "Backlog " + i, null, null, true).getId();
            squads.addMember(f.actor.id, f.project, team, f.a.id);
            squads.deleteTeam(f.actor.id, f.project, team);
        }
        db.update("UPDATE notifications SET created_at=now()-interval '1 day' WHERE id=?", first);
        assertEquals(21L, service.list(f.a.id, false, NotificationType.SQUAD_DELETED, 0, 20).getTotalElements());
        assertTrue(service.list(f.a.id, false, NotificationType.SQUAD_DELETED, 0, 20).stream()
                .noneMatch(n -> n.getId().equals(first)));
        assertEquals(first, service.claimTeamDeletion(f.a.id).orElseThrow().getId());
    }

    @Test void realFiveHundredRecipientBoundaryUsesTwoBatchChunksAndKeepsEveryRecipient() throws Exception {
        Fixture f = fixture();
        List<Object[]> accounts = new ArrayList<>(), projectMembers = new ArrayList<>(), roles = new ArrayList<>(), teamMembers = new ArrayList<>();
        for (int i = 0; i < 501; i++) {
            UUID user = UUID.randomUUID(), membership = UUID.randomUUID();
            String shortId = user.toString().substring(0, 16);
            accounts.add(new Object[]{user, user + "@example.test", shortId});
            projectMembers.add(new Object[]{membership, f.project, user});
            roles.add(new Object[]{membership});
            for (UUID team : List.of(f.team, db.queryForObject("SELECT id FROM squads WHERE project_id=? AND name='Backup'", UUID.class, f.project)))
                teamMembers.add(new Object[]{UUID.randomUUID(), team, membership, f.actor.id});
        }
        // TEST-ONLY bulk dataset, with real users, ACTIVE ProjectMembership, roles and both actual team FKs.
        db.batchUpdate("INSERT INTO users(id,email,nickname,account_status,email_verification_status,global_role,created_at,updated_at) "
                + "VALUES (?,?,?,'ACTIVE','VERIFIED','USER',now(),now())", accounts);
        db.batchUpdate("INSERT INTO project_memberships(id,project_id,user_id,status,joined_at) VALUES (?,?,?,'ACTIVE',now())", projectMembers);
        db.batchUpdate("INSERT INTO project_membership_roles(membership_id,role) VALUES (?,'TESTER')", roles);
        db.batchUpdate("INSERT INTO squad_members(id,squad_id,project_membership_id,added_by,added_at) VALUES (?,?,?,?,now())", teamMembers);
        squads.deleteTeam(f.actor.id, f.project, f.team);
        assertEquals(503L, db.queryForObject("SELECT count(*) FROM notifications WHERE resource_id=? AND type='SQUAD_DELETED'", Long.class, f.team));
        assertEquals(0L, count(f.team, f.actor.id));
        assertEquals(504L, db.queryForObject("SELECT count(*) FROM squad_members WHERE squad_id=?", Long.class, f.team));
    }

    private long count(UUID team, UUID user) {
        return db.queryForObject("SELECT count(*) FROM notifications WHERE resource_id=? AND recipient_user_id=? AND type='SQUAD_DELETED'",
                Long.class, team, user);
    }
    private Notification ownDeletion(UUID user, UUID team) {
        return service.list(user, false, NotificationType.SQUAD_DELETED, 0, 100).stream()
                .filter(n -> n.getResourceId().equals(team)).findFirst().orElseThrow();
    }
    private Fixture fixture() throws Exception {
        Account actor = account(), a = account(), b = account();
        UUID project = projects.create(actor.id, "Notification deletion " + UUID.randomUUID().toString().substring(0, 8), null, null).getId();
        UUID backup = squads.create(actor.id, project, "Backup", null, null, true).getId();
        UUID team = squads.create(actor.id, project, "Delete target", null, null, true).getId();
        for (Account member : List.of(a, b)) {
            memberships.addMember(actor.id, project, member.id, Set.of(ProjectRole.TESTER));
            squads.addMember(actor.id, project, backup, member.id); squads.addMember(actor.id, project, team, member.id);
        }
        return new Fixture(actor, a, b, project, team);
    }
    private Account account() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String email = "teamnote" + suffix + "@example.test", password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "tn" + suffix, password);
        Cookie csrf = csrf();
        var result = mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .with(request -> { request.setRemoteAddr("tn-" + suffix); return request; })
                        .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String access = result.getHeaders(HttpHeaders.SET_COOKIE).stream().filter(h -> h.startsWith("PDA_ACCESS=")).findFirst().orElseThrow();
        return new Account(id, new Cookie("PDA_ACCESS", access.split(";", 2)[0].substring("PDA_ACCESS=".length())));
    }
    private Cookie csrf() throws Exception {
        return mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
    }
    record Account(UUID id, Cookie access) {}
    record Fixture(Account actor, Account a, Account b, UUID project, UUID team) {}
}
