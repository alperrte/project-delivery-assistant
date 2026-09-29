package com.pda.notification;

import com.pda.BackendApplication;
import com.pda.notification.application.NotificationService;
import com.pda.notification.domain.NotificationType;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.application.service.ProjectService;
import com.pda.squad.application.service.SquadService;
import com.pda.task.TaskEvents;
import com.pda.task.application.TaskService;
import com.pda.task.domain.TaskPriority;
import com.pda.task.domain.TaskStatus;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class NotificationIntegrationTest {
    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }
    @Autowired UserAccounts users;
    @Autowired ProjectService projects;
    @Autowired ProjectMembershipService memberships;
    @Autowired TaskService tasks;
    @Autowired SquadService squads;
    @Autowired NotificationService notifications;
    @Autowired ApplicationEventPublisher events;
    @Autowired TransactionTemplate transaction;
    @Autowired MockMvc mvc;

    @Test void apiRequiresOwnSessionAndCsrf() throws Exception {
        Account manager = account(); Account member = account(); Account other = account();
        UUID project = projects.create(manager.id(), "Notification API " + UUID.randomUUID(), null, null).getId();
        memberships.addMember(manager.id(), project, member.id(), Set.of(ProjectRole.TESTER));
        Cookie csrf = csrf();
        String base = "/api/v1/notifications";
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(get(base + "/unread-count").cookie(member.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
        var response = mvc.perform(get(base + "?unreadOnly=true&type=PROJECT_MEMBER_ADDED&size=1")
                .cookie(member.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1)).andReturn().getResponse();
        UUID id = UUID.fromString(JsonPath.read(response.getContentAsString(), "$.content[0].id"));
        mvc.perform(get(base).cookie(other.access())).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(patch(base + "/" + id + "/read").cookie(member.access()))
                .andExpect(status().isForbidden());
        mvc.perform(patch(base + "/" + id + "/read").cookie(csrf, other.access())
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNotFound());
        mvc.perform(patch(base + "/" + id + "/read").cookie(csrf, member.access())
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true));
        mvc.perform(patch(base + "/read-all").cookie(csrf, member.access())
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0));
        mvc.perform(get(base + "?size=101").cookie(member.access())).andExpect(status().isBadRequest());
    }

    @Test void assignmentDiffSelfSuppressionPaginationAndReadIsolation() {
        UUID manager = user(); UUID a = user(); UUID b = user();
        UUID project = projects.create(manager, "Notification test " + UUID.randomUUID(), null, null).getId();
        memberships.addMember(manager, project, a, Set.of(ProjectRole.TESTER));
        memberships.addMember(manager, project, b, Set.of(ProjectRole.TESTER));
        assertEquals(1, notifications.unreadCount(a));
        assertEquals(1, notifications.unreadCount(b));
        UUID task = tasks.create(project, manager, "First task", null, null, null, null).getId();
        tasks.replaceAssignees(project, task, manager, Set.of(a, b, manager));
        assertEquals(2, notifications.unreadCount(a));
        assertEquals(2, notifications.unreadCount(b));
        assertEquals(0, notifications.unreadCount(manager));
        tasks.replaceAssignees(project, task, manager, Set.of(a, b, manager));
        assertEquals(2, notifications.unreadCount(a));
        assertEquals(2, notifications.list(a, true, null, 0, 1).getTotalElements());
        assertEquals(1, notifications.list(a, true, null, 1, 1).getContent().size());
        var page = notifications.list(a, true, NotificationType.TASK_ASSIGNED, 0, 1);
        assertEquals(1, page.getTotalElements());
        UUID id = page.getContent().getFirst().getId();
        assertThrows(java.util.NoSuchElementException.class, () -> notifications.markRead(b, id));
        assertTrue(notifications.markRead(a, id).isRead());
        assertEquals(1, notifications.unreadCount(a));
        assertEquals(1, notifications.markAllRead(a));
        assertEquals(0, notifications.unreadCount(a));
        assertEquals(2, notifications.unreadCount(b));
        tasks.update(project, task, manager, "First task", null, TaskPriority.HIGH,
                null, LocalDate.now().plusDays(7));
        tasks.changeStatus(project, task, manager, TaskStatus.TODO);
        tasks.setBlocked(project, task, manager, true, "Dependency pending");
        tasks.replaceAssignees(project, task, manager, Set.of(a, manager));
        assertEquals(4, notifications.unreadCount(a));
        assertEquals(7, notifications.unreadCount(b));
        assertEquals(0, notifications.unreadCount(manager));
    }

    @Test void rollbackProducesNoNotificationAndMembershipEventsAreSelective() {
        UUID manager = user(); UUID member = user();
        UUID project = projects.create(manager, "Rollback notification " + UUID.randomUUID(), null, null).getId();
        memberships.addMember(manager, project, member, Set.of(ProjectRole.TESTER));
        assertEquals(1, notifications.unreadCount(member));
        UUID task = tasks.create(project, manager, "Rollback task", null, null, null, null).getId();
        transaction.executeWithoutResult(status -> {
            events.publishEvent(new TaskEvents.TaskAssignedEvent(task, project, member, manager, Instant.now()));
            status.setRollbackOnly();
        });
        assertEquals(1, notifications.unreadCount(member));
        memberships.addRole(manager, project, member, ProjectRole.ANALYST);
        memberships.addRole(manager, project, member, ProjectRole.ANALYST);
        assertEquals(2, notifications.unreadCount(member));
        UUID squad = squads.create(manager, project, "Notification squad", null).getId();
        squads.addMember(manager, project, squad, member);
        squads.removeMember(manager, project, squad, member);
        assertEquals(4, notifications.unreadCount(member));
        memberships.removeMember(manager, project, member);
        assertEquals(5, notifications.unreadCount(member));
    }

    private UUID user() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return users.registerLocal("notification" + suffix + "@example.test", "n" + suffix,
                UUID.randomUUID().toString());
    }
    private Account account() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String email = "notification" + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "n" + suffix, password);
        Cookie csrf = csrf();
        var response = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                .with(request -> { request.setRemoteAddr("notification-" + suffix); return request; })
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        String header = response.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(value -> value.startsWith("PDA_ACCESS=")).findFirst().orElseThrow();
        return new Account(id, new Cookie("PDA_ACCESS", header.split(";", 2)[0].substring("PDA_ACCESS=".length())));
    }
    private Cookie csrf() throws Exception {
        Cookie value = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(value);
        return value;
    }
    private record Account(UUID id, Cookie access) {}
}
