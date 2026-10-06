package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.notification.application.NotificationService;
import com.pda.task.application.TaskDeadlineService;
import com.pda.task.application.TaskPoolService;
import com.pda.task.domain.TaskConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TaskPoolAndMyTasksApiIntegrationTest extends TaskTestBase {
    @Autowired TaskPoolService pool;
    @Autowired TaskDeadlineService deadlines;
    @Autowired NotificationService notifications;

    @ParameterizedTest @ValueSource(strings = {"SIMPLE", "ADVANCED"})
    void twoPeopleClaimingTheSameTaskLeaveExactlyOneWinner(String mode) throws Exception {
        Account pm = account("racepm");
        UUID project = project(pm, "Claim race project");
        Account a = member(project, pm, "racea");
        Account b = member(project, pm, "raceb");
        send(patch("/api/v1/projects/" + project + "/task-management-mode"), pm, "{\"mode\":\"" + mode + "\"}").andExpect(status().isOk());
        UUID task = createTask(project, pm, "{\"title\":\"Contested\",\"creationMode\":\"" + mode + "\",\"pool\":{\"open\":true}}");

        CountDownLatch go = new CountDownLatch(1);
        List<Future<UUID>> attempts = new ArrayList<>();
        try (var executor = Executors.newFixedThreadPool(2)) {
            for (Account who : List.of(a, b)) {
                attempts.add(executor.submit(() -> {
                    go.await();
                    pool.claim(project, task, who.id());
                    return who.id();
                }));
            }
            go.countDown();
            int winners = 0;
            for (Future<UUID> attempt : attempts) {
                try {
                    attempt.get();
                    winners++;
                } catch (ExecutionException e) {
                    TaskConflictException conflict = assertInstanceOf(TaskConflictException.class, e.getCause());
                    assertEquals("TASK_ALREADY_CLAIMED", conflict.code());
                }
            }
            assertEquals(1, winners);
        }
        read(tasksUrl(project) + "/" + task, pm).andExpect(status().isOk())
                .andExpect(jsonPath("$.assigneeIds.length()").value(1))
                .andExpect(jsonPath("$.pool.open").value(false))
                .andExpect(jsonPath("$.pool.claimed").value(true));
        send(post(tasksUrl(project) + "/" + task + "/claim"), a, null).andExpect(status().isConflict());
    }

    @ParameterizedTest @ValueSource(strings = {"SIMPLE", "ADVANCED"})
    void claimReleaseTeamTargetAndAuthorization(String mode) throws Exception {
        Account pm = account("poolpm");
        UUID project = project(pm, "Pool project");
        Account inTeam = member(project, pm, "poolin");
        Account notInTeam = member(project, pm, "poolout");
        Account outsider = account("pooloutsider");
        String teamBody = send(post("/api/v1/projects/" + project + "/teams"), pm, "{\"name\":\"Core\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID team = UUID.fromString(JsonPath.read(teamBody, "$.id"));
        send(post("/api/v1/projects/" + project + "/teams/" + team + "/members"), pm,
                "{\"userId\":\"" + inTeam.id() + "\"}").andExpect(status().isCreated());
        send(patch("/api/v1/projects/" + project + "/task-management-mode"), pm, "{\"mode\":\"" + mode + "\"}").andExpect(status().isOk());

        UUID teamTask = createTask(project, pm,
                "{\"title\":\"Team only\",\"creationMode\":\"" + mode + "\",\"pool\":{\"open\":true,\"teamId\":\"" + team + "\"}}");
        UUID openTask = createTask(project, pm, "{\"title\":\"Everyone\",\"creationMode\":\"" + mode + "\",\"pool\":{\"open\":true}}");
        String claim = tasksUrl(project) + "/" + teamTask + "/claim";

        mvc.perform(post(claim)).andExpect(status().isForbidden());
        send(post(claim), outsider, null).andExpect(deniedToOutsider());
        send(post(claim), notInTeam, null).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("TASK_POOL_TEAM_ONLY"));
        read("/api/v1/tasks/pool", notInTeam).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id=='" + teamTask + "')]").isEmpty())
                .andExpect(jsonPath("$.content[?(@.id=='" + openTask + "')]").isNotEmpty());
        read("/api/v1/tasks/pool", inTeam).andExpect(jsonPath("$.content[?(@.id=='" + teamTask + "')]").isNotEmpty());
        read("/api/v1/tasks/mine?projectId=" + project, inTeam).andExpect(jsonPath("$.counts.poolAvailable").value(2));
        read("/api/v1/tasks/mine?projectId=" + project, notInTeam).andExpect(jsonPath("$.counts.poolAvailable").value(1));
        send(patch(tasksUrl(project) + "/" + openTask), notInTeam,
                "{\"title\":\"Forbidden\",\"priority\":\"MEDIUM\",\"pool\":{\"open\":false}}").andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/tasks/pool")).andExpect(status().isUnauthorized());

        send(post(claim), inTeam, null).andExpect(status().isOk());
        read("/api/v1/tasks/mine?projectId=" + project, inTeam).andExpect(jsonPath("$.counts.poolAvailable").value(1));
        send(post(claim), inTeam, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_ALREADY_CLAIMED"));
        send(post(tasksUrl(project) + "/" + teamTask + "/release"), notInTeam, null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TASK_NOT_RELEASABLE"));
        send(post(tasksUrl(project) + "/" + teamTask + "/release"), inTeam, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.pool.open").value(true)).andExpect(jsonPath("$.assigneeIds.length()").value(0));
        send(post(tasksUrl(project) + "/" + openTask + "/release"), inTeam, null)
                .andExpect(status().isConflict());
    }

    @Test void assigningDirectlyLeavesThePoolAndPooledTasksRejectAssignees() throws Exception {
        Account pm = account("donepm");
        UUID project = project(pm, "Pool done project");
        Account a = member(project, pm, "donea");
        UUID task = createTask(project, pm, "{\"title\":\"Pooled\",\"pool\":{\"open\":true}}");
        send(put(tasksUrl(project) + "/" + task + "/assignees"), pm, "{\"assigneeIds\":[\"" + a.id() + "\"]}")
                .andExpect(status().isOk());
        read(tasksUrl(project) + "/" + task, pm).andExpect(jsonPath("$.pool.open").value(false));
        send(post(tasksUrl(project)), pm,
                "{\"title\":\"Pooled with owner\",\"assigneeIds\":[\"" + a.id() + "\"],\"pool\":{\"open\":true}}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TASK_POOL_HAS_ASSIGNEE"));
    }

    @Test void myTasksNeverReturnsAnotherUsersWorkAndCountsAreAccurate() throws Exception {
        Account pm = account("minepm");
        UUID first = project(pm, "Mine first project");
        UUID second = project(pm, "Mine second project");
        Account a = member(first, pm, "minea");
        memberships.addMember(pm.id(), second, a.id(), java.util.Set.of(com.pda.user.ProjectRole.TESTER));
        Account b = member(first, pm, "mineb");
        UUID overdue = createTask(first, pm, "{\"title\":\"Late\",\"assigneeIds\":[\"" + a.id() + "\"],"
                + "\"deadlineAt\":\"2020-01-01T10:00:00Z\"}");
        UUID soon = createTask(second, pm, "{\"title\":\"Soon\",\"assigneeIds\":[\"" + a.id() + "\"],"
                + "\"deadlineAt\":\"" + Instant.now().plusSeconds(3600) + "\"}");
        UUID others = createTask(first, pm, "{\"title\":\"Not mine\",\"assigneeIds\":[\"" + b.id() + "\"]}");
        createTask(first, pm, "{\"title\":\"Pooled\",\"pool\":{\"open\":true}}");

        String body = read("/api/v1/tasks/mine?userId=" + b.id(), a).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.counts.open").value(2))
                .andExpect(jsonPath("$.counts.overdue").value(1))
                .andExpect(jsonPath("$.counts.dueSoon").value(1))
                .andExpect(jsonPath("$.counts.poolAvailable").value(1))
                .andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(body, "$.content[*].id");
        assertTrue(ids.contains(overdue.toString()) && ids.contains(soon.toString()));
        assertFalse(ids.contains(others.toString()));
        List<String> projectSlugs = JsonPath.read(body, "$.content[*].project.slug");
        assertEquals(2, projectSlugs.size());

        read("/api/v1/tasks/mine?projectId=" + second, a).andExpect(jsonPath("$.totalElements").value(1));
        read("/api/v1/tasks/mine?overdue=true", a).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(overdue.toString()));
        read("/api/v1/tasks/mine?scope=DONE", a).andExpect(jsonPath("$.totalElements").value(0));
        read("/api/v1/tasks/mine?sort=password", a).andExpect(status().isBadRequest());
        read("/api/v1/tasks/mine?size=101", a).andExpect(status().isBadRequest());
        read("/api/v1/tasks/mine", b).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(others.toString()));
        read("/api/v1/tasks/counts", a).andExpect(jsonPath("$.open").value(2));
        mvc.perform(get("/api/v1/tasks/mine")).andExpect(status().isUnauthorized());

        // Leaving the project removes its tasks from the list.
        memberships.removeMember(pm.id(), second, a.id());
        read("/api/v1/tasks/mine", a).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test void deadlineReminderIsSentOnceAndMovingTheDeadlineStartsANewCycle() throws Exception {
        Account pm = account("deadlinepm");
        UUID project = project(pm, "Deadline project");
        Account a = member(project, pm, "deadlinea");
        UUID task = createTask(project, pm, "{\"title\":\"Due soon\",\"assigneeIds\":[\"" + a.id() + "\"],"
                + "\"deadlineAt\":\"" + Instant.now().plusSeconds(2 * 3600) + "\"}");
        long before = notifications.unreadCount(a.id());
        deadlines.scan();
        assertEquals(before + 1, notifications.unreadCount(a.id()));
        deadlines.scan();
        assertEquals(before + 1, notifications.unreadCount(a.id()), "a second scan must not notify again");

        send(patch(tasksUrl(project) + "/" + task), pm, "{\"title\":\"Due soon\",\"priority\":\"MEDIUM\","
                + "\"deadlineAt\":\"" + Instant.now().plusSeconds(3 * 3600) + "\"}").andExpect(status().isOk());
        long afterMove = notifications.unreadCount(a.id());
        deadlines.scan();
        assertEquals(afterMove + 1, notifications.unreadCount(a.id()));

        send(patch(tasksUrl(project) + "/" + task), pm, "{\"title\":\"Due soon\",\"priority\":\"MEDIUM\","
                + "\"deadlineAt\":\"2020-01-01T10:00:00Z\"}").andExpect(status().isOk());
        long beforeOverdue = notifications.unreadCount(a.id());
        deadlines.scan();
        deadlines.scan();
        assertEquals(beforeOverdue + 1, notifications.unreadCount(a.id()));
    }
}
