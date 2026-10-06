package com.pda.task;

import com.pda.project.ProjectAccess;
import com.pda.task.application.TaskService;
import com.pda.task.domain.TaskStatus;
import com.pda.user.ProjectRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TaskProgressNotificationApiIntegrationTest extends TaskTestBase {
    @Autowired TaskService tasks;
    @Autowired ProjectAccess projectAccess;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired ApplicationEventPublisher events;
    @Autowired ObjectMapper mapper;

    @Test void simpleStartAndCompleteNotifyEveryManagerOnceWithPersistedSnapshots() throws Exception {
        Account owner = account("progressowner");
        UUID project = project(owner, "Personal work notifications");
        Account manager = member(project, owner, "progressmanager");
        memberships.addRole(owner.id(), project, manager.id(), ProjectRole.PROJECT_MANAGER);
        Account worker = member(project, owner, "progressworker");
        UUID task = assigned(project, owner, worker, "SIMPLE");
        String key = jdbc.queryForObject("SELECT task_key FROM tasks WHERE id=?", String.class, task);
        String nickname = users.findActiveById(worker.id()).orElseThrow().nickname();

        change(project, task, worker, "IN_PROGRESS");
        assertEquals(1, statusCount(task, owner)); // Owner is also the automatic watcher.
        assertEquals(1, statusCount(task, manager)); // Does not follow or own the task.
        assertEquals(0, statusCount(task, worker)); // Acting user never notifies themself.
        read("/api/v1/notifications?type=TASK_STATUS_CHANGED", manager).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].actorUserId").value(worker.id().toString()))
                .andExpect(jsonPath("$.content[0].resourceId").value(task.toString()))
                .andExpect(jsonPath("$.content[0].statusChange.previousStatus").value("BACKLOG"))
                .andExpect(jsonPath("$.content[0].statusChange.newStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.content[0].statusChange.taskKey").value(key))
                .andExpect(jsonPath("$.content[0].statusChange.taskTitle").value("Personal task"))
                .andExpect(jsonPath("$.content[0].statusChange.actorNickname").value(nickname))
                .andExpect(jsonPath("$.content[0].message").value(nickname + " started " + key + ": Personal task."));

        change(project, task, worker, "IN_PROGRESS");
        assertEquals(1, statusCount(task, manager));
        change(project, task, worker, "DONE");
        change(project, task, worker, "DONE");
        assertEquals(2, statusCount(task, manager));
        assertEquals(2, statusCount(task, owner));
        read(tasksUrl(project) + "/" + task + "/history", owner)
                .andExpect(jsonPath("$.length()").value(2));
        read("/api/v1/tasks/mine?scope=DONE", worker).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(task.toString()));
        send(post(tasksUrl(project) + "/" + task + "/comments"), worker, "{\"body\":\"Completed and checked.\"}")
                .andExpect(status().isCreated());
        read(tasksUrl(project) + "/" + task + "/comments", worker)
                .andExpect(jsonPath("$.content[0].body").value("Completed and checked."));

        send(patch(tasksUrl(project) + "/" + task), owner,
                "{\"title\":\"Renamed task\",\"priority\":\"MEDIUM\"}").andExpect(status().isOk());
        read("/api/v1/notifications?type=TASK_STATUS_CHANGED", manager)
                .andExpect(jsonPath("$.content[0].statusChange.newStatus").value("DONE"))
                .andExpect(jsonPath("$.content[0].statusChange.taskTitle").value("Personal task"))
                .andExpect(jsonPath("$.content[0].message").value(nickname + " completed " + key + ": Personal task."));
    }

    @Test void advancedWorkflowKeepsReviewAndOnlyWorkAndDoneNotifyNonFollowingManagers() throws Exception {
        Account owner = account("advancedowner");
        UUID project = project(owner, "Advanced notification workflow");
        Account manager = member(project, owner, "advancedmanager");
        memberships.addRole(owner.id(), project, manager.id(), ProjectRole.PROJECT_MANAGER);
        Account worker = member(project, owner, "advancedworker");
        UUID task = assigned(project, owner, worker, "ADVANCED");
        change(project, task, worker, "TODO");
        assertEquals(0, statusCount(task, manager));
        change(project, task, worker, "IN_PROGRESS");
        send(patch(statusUrl(project, task)), worker, "{\"status\":\"DONE\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TASK_INVALID_TRANSITION"));
        change(project, task, worker, "IN_REVIEW");
        change(project, task, worker, "TESTING");
        assertEquals(1, statusCount(task, manager));
        change(project, task, worker, "DONE");
        assertEquals(2, statusCount(task, manager));
        assertEquals(5, statusCount(task, owner)); // Existing follower notifications are preserved.
    }

    @Test void recipientsExcludeRemovedCrossProjectAndGlobalOnlyManagers() throws Exception {
        Account owner = account("scopeowner");
        UUID project = project(owner, "Scoped status recipients");
        Account manager = member(project, owner, "scopemanager");
        memberships.addRole(owner.id(), project, manager.id(), ProjectRole.PROJECT_MANAGER);
        Account removed = member(project, owner, "removedmanager");
        memberships.addRole(owner.id(), project, removed.id(), ProjectRole.PROJECT_MANAGER);
        memberships.removeMember(owner.id(), project, removed.id());
        Account other = account("othermanager");
        project(other, "Unrelated project");
        Account admin = account("platformadmin");
        jdbc.update("UPDATE users SET global_role='ADMIN' WHERE id=?", admin.id());
        UUID task = assigned(project, owner, manager, "SIMPLE");
        assertEquals(Set.of(owner.id(), manager.id()), projectAccess.managerUserIds(project));
        assertTrue(projectAccess.managerUserIds(UUID.randomUUID()).isEmpty());
        change(project, task, manager, "IN_PROGRESS");
        change(project, task, manager, "DONE");
        assertEquals(2, statusCount(task, owner));
        for (Account excluded : new Account[]{manager, removed, other, admin}) {
            assertEquals(0, statusCount(task, excluded));
        }
        send(post("/api/v1/projects/" + project + "/archive"), owner, null).andExpect(status().isNoContent());
        assertTrue(projectAccess.managerUserIds(project).isEmpty());
    }

    @Test void unauthorizedInvalidAndRolledBackChangesHaveNoStatusNotification() throws Exception {
        Account owner = account("rollbackowner");
        UUID project = project(owner, "Rollback and access");
        Account worker = member(project, owner, "rollbackworker");
        Account unassigned = member(project, owner, "unassignedworker");
        Account outsider = account("progressoutsider");
        UUID task = assigned(project, owner, worker, "SIMPLE");
        send(patch(statusUrl(project, task)), unassigned, "{\"status\":\"IN_PROGRESS\"}").andExpect(status().isForbidden());
        send(patch(statusUrl(project, task)), outsider, "{\"status\":\"IN_PROGRESS\"}").andExpect(deniedToOutsider());
        mvc.perform(patch(statusUrl(project, task)).cookie(worker.access()).contentType("application/json")
                .content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isForbidden());
        send(patch(statusUrl(project, task)), worker, "{\"status\":\"DONE\"}").andExpect(status().isConflict());
        send(patch(statusUrl(project, task)), worker, "{\"status\":\"unknown\"}").andExpect(status().isBadRequest());
        new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
            tasks.changeStatus(project, task, worker.id(), TaskStatus.IN_PROGRESS);
            tx.setRollbackOnly();
        });
        assertEquals(0, statusCount(task, owner));
        read(tasksUrl(project) + "/" + task, worker).andExpect(jsonPath("$.status").value("BACKLOG"));
        read(tasksUrl(project) + "/" + task + "/history", owner).andExpect(jsonPath("$.length()").value(0));
    }

    @Test void concurrentIdenticalStartCreatesOnlyOneHistoryAndOneNotification() throws Exception {
        Account owner = account("concurrentowner");
        UUID project = project(owner, "Concurrent work start");
        Account worker = member(project, owner, "concurrentworker");
        UUID task = assigned(project, owner, worker, "SIMPLE");
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { start.await(); return tasks.changeStatus(project, task, worker.id(), TaskStatus.IN_PROGRESS); });
            var second = executor.submit(() -> { start.await(); return tasks.changeStatus(project, task, worker.id(), TaskStatus.IN_PROGRESS); });
            start.countDown();
            assertEquals(TaskStatus.IN_PROGRESS, first.get(20, TimeUnit.SECONDS).status());
            assertEquals(TaskStatus.IN_PROGRESS, second.get(20, TimeUnit.SECONDS).status());
        }
        assertEquals(1, statusCount(task, owner));
        read(tasksUrl(project) + "/" + task + "/history", owner).andExpect(jsonPath("$.length()").value(1));
    }

    @Test void oldSerializedPublicationsStillProduceReadableOwnScopeNotifications() throws Exception {
        Account owner = account("legacyowner");
        UUID project = project(owner, "Legacy status publication");
        Account worker = member(project, owner, "legacyworker");
        UUID task = assigned(project, owner, worker, "SIMPLE");
        // Pre-V56 publication JSON has status names but no task or nickname snapshots.
        String json = "{\"taskId\":\"" + task + "\",\"projectId\":\"" + project
                + "\",\"previousStatus\":\"BACKLOG\",\"newStatus\":\"TODO\",\"changedBy\":\"" + worker.id()
                + "\",\"assigneeIds\":[\"" + owner.id() + "\"],\"occurredAt\":\"2026-10-06T00:00:00Z\"}";
        TaskEvents.TaskStatusChangedEvent event = mapper.readValue(json, TaskEvents.TaskStatusChangedEvent.class);
        assertNull(event.taskTitle());
        new TransactionTemplate(transactionManager).executeWithoutResult(tx -> events.publishEvent(event));
        String response = read("/api/v1/notifications?type=TASK_STATUS_CHANGED", owner).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].message").value("A task you follow changed status."))
                .andExpect(jsonPath("$.content[0].statusChange").isEmpty())
                .andReturn().getResponse().getContentAsString();
        String id = com.jayway.jsonpath.JsonPath.read(response, "$.content[0].id");
        send(patch("/api/v1/notifications/" + id + "/read"), worker, null).andExpect(status().isNotFound());
        send(patch("/api/v1/notifications/" + id + "/read"), owner, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true)).andExpect(jsonPath("$.statusChange").isEmpty());
    }

    private UUID assigned(UUID project, Account owner, Account worker, String mode) throws Exception {
        return createTask(project, owner, "{\"title\":\"Personal task\",\"creationMode\":\"" + mode
                + "\",\"assigneeIds\":[\"" + worker.id() + "\"]}");
    }
    private String statusUrl(UUID project, UUID task) { return tasksUrl(project) + "/" + task + "/status"; }
    private void change(UUID project, UUID task, Account actor, String status) throws Exception {
        send(patch(statusUrl(project, task)), actor, "{\"status\":\"" + status + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(status));
    }
    private int statusCount(UUID task, Account recipient) {
        return jdbc.queryForObject("SELECT count(*) FROM notifications WHERE resource_id=? AND recipient_user_id=? AND type='TASK_STATUS_CHANGED'",
                Integer.class, task, recipient.id());
    }
}
