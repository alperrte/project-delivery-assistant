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
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class NotificationDeletionIntegrationTest {
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

    @Test void deletingOneHistoryNotificationRemovesOnlyThatRow() throws Exception {
        var a = account(); Cookie csrf = csrf();
        UUID r1 = readNote(a.id), r2 = readNote(a.id), r3 = readNote(a.id), unread = note(a.id);
        mvc.perform(delete(BASE + "/" + r1).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent()).andExpect(header().string("Cache-Control", "private, no-store"));
        assertFalse(exists(r1)); assertTrue(exists(r2)); assertTrue(exists(r3)); assertTrue(exists(unread));
        mvc.perform(get(BASE + "?read=true").cookie(a.access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        // A second delete of the same id is indistinguishable from an unknown id.
        mvc.perform(delete(BASE + "/" + r1).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
    }

    @Test void deleteAllHistoryKeepsEveryUnreadNotificationAndReturnsDeletedCount() throws Exception {
        var a = account(); var b = account(); Cookie csrf = csrf();
        for (int i = 0; i < 4; i++) note(a.id);
        UUID h1 = readNote(a.id), h2 = readNote(a.id), foreignRead = readNote(b.id), foreignUnread = note(b.id);
        mvc.perform(delete(BASE + "?read=true").cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(2));
        assertFalse(exists(h1)); assertFalse(exists(h2));
        assertEquals(4, service.unreadCount(a.id));
        mvc.perform(get(BASE + "?read=true").cookie(a.access)).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(BASE + "?read=false").cookie(a.access)).andExpect(jsonPath("$.totalElements").value(4));
        assertTrue(exists(foreignRead)); assertTrue(exists(foreignUnread));
        mvc.perform(delete(BASE + "?read=true").cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
        assertEquals(4, service.unreadCount(a.id));
    }

    @Test void foreignAndUnreadIdsLookIdenticalAndAreNeverDeleted() throws Exception {
        var a = account(); var b = account(); Cookie csrf = csrf();
        UUID aRead = readNote(a.id), aUnread = note(a.id);
        mvc.perform(delete(BASE + "/" + aRead).cookie(b.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        assertTrue(exists(aRead));
        mvc.perform(delete(BASE + "/" + aUnread).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        assertTrue(exists(aUnread)); assertFalse(rows.findById(aUnread).orElseThrow().isRead());
        mvc.perform(delete(BASE + "/" + UUID.randomUUID()).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        // Bulk delete by B never reaches the rows of A, even when a body tries to name A.
        mvc.perform(delete(BASE + "?read=true").cookie(b.access, csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"" + a.id + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(0));
        assertTrue(exists(aRead));
    }

    @Test void authenticationCsrfAndInputValidation() throws Exception {
        var a = account(); Cookie csrf = csrf();
        UUID read = readNote(a.id), unread = note(a.id);
        mvc.perform(delete(BASE + "/" + read).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(BASE + "?read=true").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(BASE + "/" + read).cookie(a.access)).andExpect(status().isForbidden());
        mvc.perform(delete(BASE + "?read=true").cookie(a.access)).andExpect(status().isForbidden());
        for (String q : List.of("", "?read=false", "?read=invalid"))
            mvc.perform(delete(BASE + q).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isBadRequest());
        mvc.perform(delete(BASE + "/not-a-uuid").cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest());
        assertTrue(exists(read)); assertTrue(exists(unread));
    }

    @Test void deletingReadTeamDeletionHistoryDoesNotBreakTheClaimOfOtherUnreadRows() throws Exception {
        var a = account(); Cookie csrf = csrf();
        UUID readDeleted = teamDeleted(a.id); service.markRead(a.id, readDeleted);
        UUID pending = teamDeleted(a.id);
        mvc.perform(delete(BASE + "/" + readDeleted).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        assertFalse(exists(readDeleted));
        mvc.perform(post(BASE + "/team-deletions/claim").cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(pending.toString()))
                .andExpect(jsonPath("$.read").value(false));
        // A claimed-but-unread popup row is still unread, hence not deletable until it is read.
        mvc.perform(delete(BASE + "/" + pending).cookie(a.access, csrf).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        assertTrue(exists(pending));
    }

    private boolean exists(UUID id) { return Boolean.TRUE.equals(db.queryForObject("select exists(select 1 from notifications where id=?)", Boolean.class, id)); }
    private UUID teamDeleted(UUID user) {
        var snapshot = new TeamDeletion("Project snapshot", "Team snapshot", "Actor", Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS));
        return tx.execute(status -> rows.saveAndFlush(Notification.teamDeleted(user, UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID(), snapshot)).getId());
    }
    private UUID note(UUID user) {
        return tx.execute(status -> rows.saveAndFlush(new Notification(user, NotificationType.PROJECT_MEMBER_ADDED,
                "Persisted title", "Plain text message", null, UUID.randomUUID(), ResourceType.PROJECT, UUID.randomUUID())).getId());
    }
    private UUID readNote(UUID user) { UUID id = note(user); service.markRead(user, id); return id; }
    private Account account() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", ""); String email = "del" + suffix + "@example.test", password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "d" + suffix.substring(0, 20), password); Cookie csrf = csrf();
        var response = mvc.perform(post("/api/v1/auth/login").cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String header = response.getHeaders(HttpHeaders.SET_COOKIE).stream().filter(v -> v.startsWith("PDA_ACCESS=")).findFirst().orElseThrow();
        return new Account(id, new Cookie("PDA_ACCESS", header.split(";", 2)[0].substring("PDA_ACCESS=".length())));
    }
    private Cookie csrf() throws Exception { return mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN"); }
    private record Account(UUID id, Cookie access) {}
}
