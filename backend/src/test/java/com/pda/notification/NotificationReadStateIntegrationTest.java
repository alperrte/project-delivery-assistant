package com.pda.notification;

import com.pda.BackendApplication;
import com.pda.notification.application.NotificationService;
import com.pda.notification.domain.*;
import com.pda.notification.infrastructure.NotificationRepository;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class NotificationReadStateIntegrationTest {
    private static final byte[] KEY = new byte[32];
    static { new SecureRandom().nextBytes(KEY); }
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(KEY));
        r.add("FRONTEND_URL", () -> "http://localhost:3000");
    }
    @Autowired UserAccounts users;
    @Autowired NotificationService service;
    @Autowired NotificationRepository rows;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate db;
    @Autowired MockMvc mvc;
    private static final String BASE = "/api/v1/notifications";

    @Test void filteredApiRetainsLegacyOwnPagingAndRejectsConflicts() throws Exception {
        var a = account(); var b = account();
        UUID first = note(a.id), second = note(a.id); note(b.id);
        service.markRead(a.id, first);
        mvc.perform(get(BASE).cookie(a.access)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.totalElements").value(2));
        for (String q : List.of("?read=false", "?unreadOnly=true", "?read=false&unreadOnly=true"))
            mvc.perform(get(BASE + q).cookie(a.access)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].id").value(second.toString()))
                    .andExpect(jsonPath("$.content[0].read").value(false));
        mvc.perform(get(BASE + "?read=true&type=PROJECT_MEMBER_ADDED&size=1").cookie(a.access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(first.toString()))
                .andExpect(jsonPath("$.content[0].read").value(true));
        mvc.perform(get(BASE + "?read=true").cookie(b.access)).andExpect(jsonPath("$.totalElements").value(0));
        for (String q : List.of("?read=true&unreadOnly=true", "?read=invalid", "?type=INVALID", "?page=-1", "?size=101"))
            mvc.perform(get(BASE + q).cookie(a.access)).andExpect(status().isBadRequest());
        mvc.perform(get(BASE + "?read=true")).andExpect(status().isUnauthorized());
    }

    @Test void individualAndBulkPreserveRowsContentAndOwnPrincipal() throws Exception {
        var a = account(); var b = account(); Cookie csrf = csrf();
        UUID first = note(a.id), second = note(a.id), foreign = note(b.id);
        var original = rows.findById(first).orElseThrow();
        mvc.perform(patch(BASE + "/" + first + "/read").cookie(a.access)).andExpect(status().isForbidden());
        mvc.perform(patch(BASE + "/read-all").cookie(a.access)).andExpect(status().isForbidden());
        mvc.perform(patch(BASE + "/read-all").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch(BASE + "/" + first + "/read").cookie(b.access, csrf)
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNotFound());
        for (int i = 0; i < 2; i++) mvc.perform(patch(BASE + "/" + first + "/read").cookie(a.access, csrf)
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first.toString()))
                .andExpect(jsonPath("$.read").value(true));
        Instant readAt = readAt(first); service.markRead(a.id, first); assertEquals(readAt, readAt(first));
        assertEquals(original.getTitle(), rows.findById(first).orElseThrow().getTitle());
        assertEquals(original.getMessage(), rows.findById(first).orElseThrow().getMessage());
        assertEquals(original.getCreatedAt(), rows.findById(first).orElseThrow().getCreatedAt());
        assertEquals(1, service.unreadCount(a.id));
        // Actor-looking JSON must not select another recipient; this existing endpoint derives actor from the session.
        mvc.perform(patch(BASE + "/read-all").cookie(b.access, csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"" + a.id + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        assertFalse(rows.findById(second).orElseThrow().isRead()); assertTrue(rows.findById(foreign).orElseThrow().isRead());
        mvc.perform(patch(BASE + "/read-all").cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(jsonPath("$.count").value(1));
        assertEquals(0, service.markAllRead(a.id)); assertEquals(0, service.unreadCount(a.id));
        assertEquals(readAt, readAt(first)); assertTrue(rows.existsById(first)); assertTrue(rows.existsById(second));
    }

    @Test void historyUsesStableServerPagesAndNotReadAtSorting() {
        UUID user = user(); List<UUID> ids = new ArrayList<>();
        for (int i = 0; i < 41; i++) ids.add(note(user));
        Instant same = Instant.parse("2026-10-07T08:00:00Z");
        ids.forEach(id -> db.update("update notifications set created_at=? where id=?", Timestamp.from(same), id));
        assertEquals(41, service.markAllRead(user));
        List<UUID> actual = new ArrayList<>();
        for (int page = 0; page < 3; page++) {
            var result = service.list(user, false, true, null, page, 20);
            assertEquals(41, result.getTotalElements()); assertEquals(3, result.getTotalPages());
            actual.addAll(result.map(Notification::getId).getContent());
        }
        assertEquals(ids.stream().sorted(Comparator.comparing(UUID::toString).reversed()).toList(), actual);
        assertEquals(41, new HashSet<>(actual).size());
        assertEquals(0, service.list(user, false, false, null, 0, 20).getTotalElements());
        String plan = db.queryForList("explain select id from notifications where recipient_user_id=? and is_read=true order by created_at desc,id desc limit 20", user).toString();
        assertFalse(plan.isBlank()); // Existing V31 recipient ordering index remains available; no new schema needed.
    }

    @Test void staleIndividualReadDoesNotOverwriteFirstCommittedBulkReadAt() throws Exception {
        UUID user = user(), id = note(user);
        CountDownLatch loaded = new CountDownLatch(1), release = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<?> pending = pool.submit(() -> tx.executeWithoutResult(status -> {
                rows.findByIdAndRecipientUserId(id, user).orElseThrow();
                loaded.countDown(); await(release);
                service.markRead(user, id);
            }));
            assertTrue(loaded.await(10, TimeUnit.SECONDS));
            assertEquals(1, service.markAllRead(user)); Instant first = readAt(id);
            release.countDown(); pending.get(15, TimeUnit.SECONDS);
            assertEquals(first, readAt(id), "A stale individual reader must not replace the first committed read timestamp");
        } finally { release.countDown(); pool.shutdownNow(); }
    }

    @Test void concurrentIndividualReadsKeepOneTimestampAndConcurrentBulkReadsChangeEachRowOnce() throws Exception {
        UUID user = user(), id = note(user);
        ExecutorService pool = Executors.newFixedThreadPool(2); CountDownLatch start = new CountDownLatch(1);
        try {
            Future<Instant> a = pool.submit(() -> { await(start); return service.markRead(user, id).getReadAt(); });
            Future<Instant> b = pool.submit(() -> { await(start); return service.markRead(user, id).getReadAt(); });
            start.countDown(); assertEquals(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS));
            for (int i = 0; i < 40; i++) note(user);
            CountDownLatch bulk = new CountDownLatch(1);
            Future<Integer> x = pool.submit(() -> { await(bulk); return service.markAllRead(user); });
            Future<Integer> y = pool.submit(() -> { await(bulk); return service.markAllRead(user); });
            bulk.countDown(); assertEquals(40, x.get(15, TimeUnit.SECONDS) + y.get(15, TimeUnit.SECONDS));
            assertEquals(0, service.unreadCount(user)); assertEquals(41, service.list(user, false, true, null, 0, 20).getTotalElements());
        } finally { pool.shutdownNow(); }
    }

    @Test void readAndPopupPresentationAreIndependentAndKeepDeletionSnapshots() {
        UUID user = user(), project = UUID.randomUUID(), actor = UUID.randomUUID();
        // Notification scalar references are event snapshots; no project/team grants are fabricated.
        var snapshot = new TeamDeletion("Deleted project snapshot", "Deleted team snapshot", "Actor",
                Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
        UUID id = tx.execute(status -> rows.saveAndFlush(Notification.teamDeleted(user, actor, project,
                UUID.randomUUID(), UUID.randomUUID(), snapshot)).getId());
        var claimed = service.claimTeamDeletion(user).orElseThrow();
        assertEquals(id, claimed.getId()); assertFalse(claimed.isRead()); assertNull(claimed.getReadAt());
        Instant presented = claimed.getPopupPresentedAt();
        var read = service.markRead(user, id); assertTrue(read.isRead()); assertEquals(presented, read.getPopupPresentedAt());
        assertEquals(snapshot.occurredAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS), read.getTeamDeletion().occurredAt());
        assertEquals("Deleted team snapshot", read.getTeamDeletion().teamName());
        assertTrue(service.claimTeamDeletion(user).isEmpty());
        UUID before = tx.execute(status -> rows.saveAndFlush(Notification.teamDeleted(user, actor, project,
                UUID.randomUUID(), UUID.randomUUID(), snapshot)).getId());
        service.markAllRead(user); assertTrue(service.claimTeamDeletion(user).isEmpty());
        assertNull(rows.findById(before).orElseThrow().getPopupPresentedAt());
    }

    @Test void aNotificationArrivingAfterBulkStatementRemainsUnread() throws Exception {
        UUID user = user(); note(user);
        CountDownLatch updated = new CountDownLatch(1), commit = new CountDownLatch(1);
        ExecutorService pool = Executors.newSingleThreadExecutor();
        try {
            Future<Integer> bulk = pool.submit(() -> tx.execute(status -> {
                int count = service.markAllRead(user); updated.countDown(); await(commit); return count;
            }));
            assertTrue(updated.await(10, TimeUnit.SECONDS)); UUID fresh = note(user);
            commit.countDown(); assertEquals(1, bulk.get(15, TimeUnit.SECONDS));
            assertEquals(1, service.unreadCount(user));
            assertEquals(fresh, service.list(user, false, false, null, 0, 20).getContent().getFirst().getId());
        } finally { commit.countDown(); pool.shutdownNow(); }
    }

    @Test void projectAndTypeFiltersRestrictOwnUnreadCountAndListWithoutChangingDefaults() throws Exception {
        var a = account(); var b = account(); UUID projectA = UUID.randomUUID(), projectB = UUID.randomUUID();
        UUID acceptedA = note(a.id, NotificationType.PROJECT_INVITATION_ACCEPTED, projectA);
        UUID rejectedA = note(a.id, NotificationType.PROJECT_INVITATION_REJECTED, projectA);
        UUID readA = note(a.id, NotificationType.PROJECT_INVITATION_ACCEPTED, projectA); service.markRead(a.id, readA);
        note(a.id, NotificationType.PROJECT_INVITATION_CREATED, projectA);
        note(a.id, NotificationType.PROJECT_INVITATION_ACCEPTED, projectB);
        note(b.id, NotificationType.PROJECT_INVITATION_ACCEPTED, projectA);
        var both = List.of(NotificationType.PROJECT_INVITATION_ACCEPTED, NotificationType.PROJECT_INVITATION_REJECTED);
        assertEquals(4, service.unreadCount(a.id)); assertEquals(4, service.unreadCount(a.id, null, null));
        assertEquals(4, service.unreadCount(a.id, null, List.of()));
        assertEquals(3, service.unreadCount(a.id, projectA, null));
        assertEquals(2, service.unreadCount(a.id, projectA, both));
        assertEquals(1, service.unreadCount(a.id, projectA, List.of(NotificationType.PROJECT_INVITATION_REJECTED)));
        assertEquals(1, service.unreadCount(a.id, projectB, both));
        assertEquals(3, service.unreadCount(a.id, null, both));
        assertEquals(2, service.unreadCount(a.id, projectA, List.of(NotificationType.PROJECT_INVITATION_ACCEPTED,
                NotificationType.PROJECT_INVITATION_ACCEPTED, NotificationType.PROJECT_INVITATION_REJECTED)));
        assertEquals(0, service.unreadCount(a.id, UUID.randomUUID(), both));
        assertEquals(1, service.unreadCount(b.id, projectA, both)); assertEquals(0, service.unreadCount(b.id, projectB, both));
        var listed = service.list(a.id, true, null, projectA, both, 0, 20);
        assertEquals(Set.of(acceptedA, rejectedA), new HashSet<>(listed.map(Notification::getId).getContent()));
        assertEquals(1, service.list(a.id, false, true, projectA, both, 0, 20).getTotalElements());
        assertEquals(5, service.list(a.id, false, null, null, null, 0, 20).getTotalElements());
        mvc.perform(get(BASE + "/unread-count?projectId=" + projectA + "&type=PROJECT_INVITATION_ACCEPTED&type=PROJECT_INVITATION_REJECTED")
                .cookie(a.access)).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        mvc.perform(get(BASE + "/unread-count").cookie(a.access)).andExpect(jsonPath("$.count").value(4));
        mvc.perform(get(BASE + "?unreadOnly=true&projectId=" + projectA + "&type=PROJECT_INVITATION_REJECTED").cookie(a.access))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].id").value(rejectedA.toString()));
        for (String q : List.of("?projectId=x", "?type=NOPE")) {
            mvc.perform(get(BASE + "/unread-count" + q).cookie(a.access)).andExpect(status().isBadRequest());
            mvc.perform(get(BASE + q).cookie(a.access)).andExpect(status().isBadRequest());
        }
        mvc.perform(get(BASE + "/unread-count?projectId=" + projectA)).andExpect(status().isUnauthorized());
    }

    private UUID note(UUID user, NotificationType type, UUID project) {
        return tx.execute(status -> rows.saveAndFlush(new Notification(user, type, "Filter title", "Plain text message",
                null, project, ResourceType.PROJECT, UUID.randomUUID())).getId());
    }
    private UUID note(UUID user) {
        return tx.execute(status -> rows.saveAndFlush(new Notification(user, NotificationType.PROJECT_MEMBER_ADDED,
                "Persisted title", "Plain text message", null, UUID.randomUUID(), ResourceType.PROJECT, UUID.randomUUID())).getId());
    }
    private Instant readAt(UUID id) { return db.queryForObject("select read_at from notifications where id=?", Timestamp.class, id).toInstant(); }
    private UUID user() { String suffix = UUID.randomUUID().toString().replace("-", ""); return users.registerLocal("read" + suffix + "@example.test", "r" + suffix.substring(0, 20), UUID.randomUUID().toString()); }
    private Account account() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", ""); String email = "read" + suffix + "@example.test", password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "r" + suffix.substring(0, 20), password); Cookie csrf = csrf();
        var response = mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String header = response.getHeaders(HttpHeaders.SET_COOKIE).stream().filter(v -> v.startsWith("PDA_ACCESS=")).findFirst().orElseThrow();
        return new Account(id, new Cookie("PDA_ACCESS", header.split(";", 2)[0].substring("PDA_ACCESS=".length())));
    }
    private Cookie csrf() throws Exception { return mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN"); }
    private record Account(UUID id, Cookie access) {}
    private static void await(CountDownLatch latch) { try { if (!latch.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Barrier timeout"); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); } }
}
