package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.project.ProjectAccess;
import com.pda.project.TaskManagementMode;
import com.pda.project.application.service.ProjectService;
import com.pda.task.application.*;
import com.pda.task.domain.*;
import com.pda.user.ProjectRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real PostgreSQL/API coverage of policies, model invariants, retention and concurrent writers. */
class TaskModesApiIntegrationTest extends TaskTestBase {
    @Autowired ProjectService projects;
    @Autowired ProjectAccess projectAccess;
    @Autowired TaskService tasks;
    @Autowired TaskChecklistService checklist;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;

    private String policyUrl(UUID project) { return "/api/v1/projects/" + project + "/task-management-mode"; }
    private void policy(UUID project, Account owner, String mode) throws Exception {
        send(patch(policyUrl(project)), owner, "{\"mode\":\"" + mode + "\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.taskManagementMode").value(mode));
    }
    private UUID id(String response) { return UUID.fromString(JsonPath.read(response, "$.id")); }
    private String body(String mode) { return "{\"title\":\"Task\",\"priority\":\"MEDIUM\",\"creationMode\":\"" + mode + "\"}"; }
    private String update(String fields) { return "{\"title\":\"Updated\",\"priority\":\"HIGH\"" + fields + "}"; }
    private UUID task(UUID project, Account owner, String mode) throws Exception {
        return createTask(project, owner, body(mode));
    }

    @Test void newProjectRequiresFounderChoiceAndValidAuthenticatedCsrfRequest() throws Exception {
        Account owner = account("modeowner");
        String response = send(post("/api/v1/projects"), owner, "{\"name\":\"Unconfigured model\"}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.taskManagementMode").isEmpty())
                .andReturn().getResponse().getContentAsString();
        UUID project = id(response);
        send(post(tasksUrl(project)), owner, body("SIMPLE")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_TASK_MODE_NOT_CONFIGURED"));
        send(post("/api/v1/projects/" + project + "/labels"), owner, "{\"name\":\"Label\",\"color\":\"blue\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_TASK_MODE_NOT_CONFIGURED"));
        mvc.perform(patch(policyUrl(project)).cookie(owner.access()).contentType("application/json")
                .content("{\"mode\":\"BOTH\"}")).andExpect(status().isForbidden());
        send(patch(policyUrl(project)), owner, "{}").andExpect(status().isBadRequest());
        send(patch(policyUrl(project)), owner, "{\"mode\":\"system\"}").andExpect(status().isBadRequest());
        policy(project, owner, "SIMPLE");
        read("/api/v1/projects/" + project, owner).andExpect(jsonPath("$.taskManagementMode").value("SIMPLE"));
        send(post(tasksUrl(project)), owner, body("SIMPLE")).andExpect(status().isCreated());
        send(patch(policyUrl(UUID.randomUUID())), owner, "{\"mode\":\"BOTH\"}").andExpect(status().isNotFound());
    }

    @Test void coManagerAndGlobalAdminCannotChangeFounderPolicy() throws Exception {
        Account owner = account("founder");
        UUID project = project(owner, "Founder policy");
        Account coManager = member(project, owner, "copm");
        memberships.addRole(owner.id(), project, coManager.id(), ProjectRole.PROJECT_MANAGER);
        Account outsider = account("modeoutsider");
        jdbc.update("UPDATE users SET global_role='ADMIN' WHERE id=?", coManager.id());
        send(patch(policyUrl(project)), coManager, "{\"mode\":\"SIMPLE\"}").andExpect(status().isForbidden());
        send(patch(policyUrl(project)), outsider, "{\"mode\":\"SIMPLE\"}").andExpect(deniedToOutsider());
        read("/api/v1/projects/" + project, owner).andExpect(jsonPath("$.taskManagementMode").value("BOTH"));
        policy(project, owner, "ADVANCED");
        send(post("/api/v1/projects/" + project + "/archive"), owner, null).andExpect(status().isNoContent());
        send(patch(policyUrl(project)), owner, "{\"mode\":\"BOTH\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"));
        send(patch(policyUrl(project)), outsider, "{\"mode\":\"BOTH\"}").andExpect(status().isNotFound());
    }

    @ParameterizedTest @EnumSource(TaskManagementMode.class)
    void projectPoliciesControlCreationAndKeepLegacyDefault(TaskManagementMode mode) throws Exception {
        Account owner = account("policy");
        UUID project = project(owner, "Policy " + mode);
        policy(project, owner, mode.name());
        for (TaskCreationMode type : TaskCreationMode.values()) {
            var result = send(post(tasksUrl(project)), owner, body(type.name()));
            if (mode.allows(type.name())) result.andExpect(status().isCreated()).andExpect(jsonPath("$.creationMode").value(type.name()));
            else result.andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TASK_MODE_NOT_ALLOWED"));
        }
        var legacy = send(post(tasksUrl(project)), owner, "{\"title\":\"Legacy caller\"}");
        if (mode == TaskManagementMode.SIMPLE) legacy.andExpect(status().isConflict());
        else legacy.andExpect(status().isCreated()).andExpect(jsonPath("$.creationMode").value("ADVANCED"));
    }

    @ParameterizedTest @ValueSource(strings = {
            ",\"estimatePoints\":3", ",\"timeEstimateMinutes\":30",
            ",\"parentTaskId\":\"00000000-0000-0000-0000-000000000001\"",
            ",\"sprintId\":\"00000000-0000-0000-0000-000000000001\"",
            ",\"labelIds\":[\"00000000-0000-0000-0000-000000000001\"]"
    })
    void simpleCreateRejectsEveryAdvancedPayload(String extra) throws Exception {
        Account owner = account("payload");
        UUID project = project(owner, "Payload invariant");
        String json = body("SIMPLE");
        send(post(tasksUrl(project)), owner, json.substring(0, json.length()-1) + extra + "}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("TASK_SIMPLE_FIELDS_INVALID"));
        read(tasksUrl(project), owner).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test void basicFieldsCommentsMentionsStatusAndTimelineWorkInEveryPolicy() throws Exception {
        Account owner = account("common");
        UUID project = project(owner, "Common features");
        UUID simple = task(project, owner, "SIMPLE");
        Account member = member(project, owner, "commonmember");
        policy(project, owner, "SIMPLE");
        String base = tasksUrl(project) + "/" + simple;
        send(patch(base), owner, update(",\"description\":\"Details\",\"startDate\":\"2026-10-05\",\"deadlineAt\":\"2026-10-06T12:00:00Z\""))
                .andExpect(status().isOk()).andExpect(jsonPath("$.creationMode").value("SIMPLE"));
        send(put(base + "/assignees"), owner, "{\"assigneeIds\":[\"" + member.id() + "\"]}").andExpect(status().isOk());
        String comment = send(post(base + "/comments"), member, "{\"body\":\"Hello @[" + owner.id() + "]\"}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.mentions.length()").value(1))
                .andReturn().getResponse().getContentAsString();
        send(patch(base + "/comments/" + id(comment)), member, "{\"body\":\"Edited\"}").andExpect(status().isOk());
        send(patch(base + "/status"), member, "{\"status\":\"TODO\"}").andExpect(status().isOk());
        read(base + "/history", owner).andExpect(jsonPath("$.length()").value(1));
        read(base + "/activity?filter=COMMENTS", owner).andExpect(jsonPath("$.totalElements").value(1));
        policy(project, owner, "ADVANCED");
        send(patch(base), owner, update("")).andExpect(status().isOk());
        send(post(base + "/comments"), owner, "{\"body\":\"Simple task remains usable\"}").andExpect(status().isCreated());
        read("/api/v1/tasks/mine?projectId=" + project, member)
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].creationMode").value("SIMPLE"));
        send(delete(base), owner, null).andExpect(status().isNoContent());
        read(base, owner).andExpect(status().isNotFound());
    }

    @ParameterizedTest @ValueSource(strings = {"SIMPLE_TASK", "CLOSED_PROJECT"})
    void allAdvancedWritersRejectSimpleOrClosedPolicyButReadsRemain(String scenario) throws Exception {
        Account owner = account("guards");
        UUID project = project(owner, "Advanced guards");
        UUID task = task(project, owner, scenario.equals("SIMPLE_TASK") ? "SIMPLE" : "ADVANCED");
        UUID target = task(project, owner, "ADVANCED");
        if (scenario.equals("CLOSED_PROJECT")) policy(project, owner, "SIMPLE");
        String base = tasksUrl(project) + "/" + task;
        String[] posts = {"/checklist", "/worklogs", "/relations"};
        String[] jsons = {"{\"text\":\"Item\"}", "{\"minutes\":30,\"workDate\":\"" + LocalDate.now() + "\"}",
                "{\"type\":\"RELATES\",\"targetTaskId\":\"" + target + "\"}"};
        for (int i=0; i<posts.length; i++) send(post(base + posts[i]), owner, jsons[i])
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TASK_MODE_NOT_ALLOWED"));
        send(put(base + "/watch"), owner, null).andExpect(status().isConflict());
        send(delete(base + "/watch"), owner, null).andExpect(status().isConflict());
        send(put(base + "/labels"), owner, "{\"labelIds\":[]}").andExpect(status().isConflict());
        send(put(base + "/sprint"), owner, "{\"sprintId\":null}").andExpect(status().isConflict());
        send(patch(base + "/blocked"), owner, "{\"blocked\":true,\"reason\":\"Blocked\"}").andExpect(status().isConflict());
        send(patch(base), owner, update(",\"estimatePoints\":5")).andExpect(status().isConflict());
        send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart(base + "/attachments")
                .file(new org.springframework.mock.web.MockMultipartFile("file", "a.txt", "text/plain", "text".getBytes())), owner, null)
                .andExpect(status().isConflict());
        for (String path : new String[]{"/checklist", "/worklogs", "/relations", "/watchers", "/attachments"}) {
            read(base + path, owner).andExpect(status().isOk());
        }
        if (scenario.equals("CLOSED_PROJECT")) {
            send(post("/api/v1/projects/" + project + "/labels"), owner, "{\"name\":\"New\",\"color\":\"blue\"}")
                    .andExpect(status().isConflict());
            send(post("/api/v1/projects/" + project + "/sprints"), owner,
                    "{\"name\":\"New\",\"startDate\":\"2026-10-05\",\"endDate\":\"2026-10-12\"}").andExpect(status().isConflict());
            read("/api/v1/projects/" + project + "/labels", owner).andExpect(status().isOk());
            read("/api/v1/projects/" + project + "/sprints", owner).andExpect(status().isOk());
        }
    }

    @Test void omittedAdvancedFieldsRetainLegacyDataAndExplicitNullRequiresEnabledProject() throws Exception {
        Account owner = account("retain");
        UUID project = project(owner, "Retained legacy task");
        UUID parent = task(project, owner, "ADVANCED");
        String sprint = send(post("/api/v1/projects/" + project + "/sprints"), owner,
                "{\"name\":\"Retained\",\"startDate\":\"2026-10-05\",\"endDate\":\"2026-10-12\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID child = createTask(project, owner, "{\"title\":\"Child\",\"parentTaskId\":\"" + parent
                + "\",\"sprintId\":\"" + id(sprint) + "\",\"estimatePoints\":8,\"timeEstimateMinutes\":60}");
        String base = tasksUrl(project) + "/" + child;
        send(patch(base + "/blocked"), owner, "{\"blocked\":true,\"reason\":\"Old blocker\"}").andExpect(status().isOk());
        policy(project, owner, "SIMPLE");
        send(patch(base), owner, update("")).andExpect(status().isOk())
                .andExpect(jsonPath("$.estimatePoints").value(8)).andExpect(jsonPath("$.timeEstimateMinutes").value(60))
                .andExpect(jsonPath("$.parent.id").value(parent.toString())).andExpect(jsonPath("$.sprint.id").value(id(sprint).toString()));
        send(patch(base), owner, update(",\"estimatePoints\":null")).andExpect(status().isConflict());
        send(patch(base + "/blocked"), owner, "{\"blocked\":false}").andExpect(status().isOk());
        send(post(base + "/comments"), owner, "{\"body\":\"Still usable\"}").andExpect(status().isCreated());
        policy(project, owner, "BOTH");
        send(patch(base), owner, update(",\"estimatePoints\":null,\"timeEstimateMinutes\":null,\"parentTaskId\":null,\"sprintId\":null"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estimatePoints").isEmpty())
                .andExpect(jsonPath("$.parent").isEmpty()).andExpect(jsonPath("$.sprint").isEmpty());
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.creationMode").value("SIMPLE")).andExpect(jsonPath("$.commentCount").value(1));
    }

    @Test void conversionsPreserveCommentsAndRejectManualWatchAndChecklistData() throws Exception {
        Account owner = account("convert");
        UUID project = project(owner, "Conversions");
        UUID simple = task(project, owner, "SIMPLE");
        String base = tasksUrl(project) + "/" + simple;
        policy(project, owner, "SIMPLE");
        send(patch(base), owner, update(",\"creationMode\":\"ADVANCED\"")).andExpect(status().isConflict());
        policy(project, owner, "BOTH");
        send(patch(base), owner, update(",\"creationMode\":\"ADVANCED\",\"estimatePoints\":3"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.creationMode").value("ADVANCED"));
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_MODE_CONVERSION_BLOCKED"));
        send(patch(base), owner, update(",\"estimatePoints\":null")).andExpect(status().isOk());
        String item = send(post(base + "/checklist"), owner, "{\"text\":\"Preserve\"}").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isConflict());
        send(delete(base + "/checklist/" + id(item)), owner, null).andExpect(status().isNoContent());
        send(put(base + "/watch"), owner, null).andExpect(status().isOk());
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isConflict());
        send(delete(base + "/watch"), owner, null).andExpect(status().isOk());
        send(post(base + "/comments"), owner, "{\"body\":\"Common comment with automatic watch\"}").andExpect(status().isCreated());
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.commentCount").value(1));
        read(base + "/activity?filter=EVENTS", owner)
                .andExpect(jsonPath("$.content[?(@.event.field=='creationMode')].event.newValue")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("ADVANCED", "SIMPLE")));
        send(patch(base), owner, update(",\"creationMode\":\"UNKNOWN\"")).andExpect(status().isBadRequest());
    }

    @Test void relationsAndParentLinksCannotIntroduceAdvancedDataToSimpleTasks() throws Exception {
        Account owner = account("links");
        UUID project = project(owner, "Link invariant");
        UUID simple = task(project, owner, "SIMPLE");
        UUID advanced = task(project, owner, "ADVANCED");
        String base = tasksUrl(project) + "/" + advanced;
        send(post(base + "/relations"), owner, "{\"type\":\"BLOCKS\",\"targetTaskId\":\"" + simple + "\"}").andExpect(status().isConflict());
        send(patch(base), owner, update(",\"parentTaskId\":\"" + simple + "\"")).andExpect(status().isConflict());
        UUID foreign = task(project(owner, "Foreign scope"), owner, "ADVANCED");
        send(post(base + "/relations"), owner, "{\"type\":\"RELATES\",\"targetTaskId\":\"" + foreign + "\"}").andExpect(status().isNotFound());
        Account outsider = account("private");
        send(patch(tasksUrl(project) + "/" + simple), outsider, update(",\"estimatePoints\":5")).andExpect(deniedToOutsider());
    }

    @Test void typeFilterIsAppliedBeforePagingAndPoolCountsRespectCurrentPolicy() throws Exception {
        Account owner = account("filter");
        UUID project = project(owner, "Filtered tasks");
        task(project, owner, "ADVANCED");
        UUID simple = task(project, owner, "SIMPLE");
        task(project, owner, "SIMPLE");
        UUID pooled = createTask(project, owner, "{\"title\":\"Pool\",\"pool\":{\"open\":true}}");
        read(tasksUrl(project) + "?creationMode=SIMPLE&size=1&page=1&sort=taskNumber,asc", owner)
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].creationMode").value("SIMPLE"));
        read(tasksUrl(project) + "?creationMode=ADVANCED&pool=true", owner).andExpect(jsonPath("$.totalElements").value(1));
        read(tasksUrl(project) + "?creationMode=SIMPLE&priority=CRITICAL", owner).andExpect(jsonPath("$.totalElements").value(0));
        read(tasksUrl(project) + "?creationMode=UNKNOWN", owner).andExpect(status().isBadRequest());
        read("/api/v1/tasks/pool?projectId=" + project, owner).andExpect(jsonPath("$.totalElements").value(1));
        policy(project, owner, "SIMPLE");
        read("/api/v1/tasks/pool?projectId=" + project, owner).andExpect(jsonPath("$.totalElements").value(1));
        send(post(tasksUrl(project) + "/" + pooled + "/claim"), owner, null).andExpect(status().isOk());
        read(tasksUrl(project) + "/" + pooled, owner).andExpect(jsonPath("$.pool.claimed").value(true));
        send(post(tasksUrl(project) + "/" + pooled + "/release"), owner, null).andExpect(status().isOk());
        send(delete(tasksUrl(project) + "/" + simple), owner, null).andExpect(status().isNoContent());
        read(tasksUrl(project) + "?creationMode=SIMPLE", owner).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test void policyChangeWaitsForInFlightCreationAndThenRejectsNextCreation() throws Exception {
        Account owner = account("racepolicy");
        UUID project = project(owner, "Concurrent policy");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch holding = new CountDownLatch(1), release = new CountDownLatch(1), started = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<UUID> create = executor.submit(() -> tx.execute(status -> {
                projectAccess.lockTaskContext(project);
                holding.countDown();
                await(release);
                return tasks.create(project, owner.id(), command(TaskCreationMode.ADVANCED)).id();
            }));
            assertTrue(holding.await(10, TimeUnit.SECONDS));
            Future<?> change = executor.submit(() -> {
                started.countDown();
                projects.changeTaskManagementMode(owner.id(), project, TaskManagementMode.SIMPLE);
            });
            try {
                assertTrue(started.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> change.get(300, TimeUnit.MILLISECONDS));
            } finally { release.countDown(); }
            UUID created = create.get(10, TimeUnit.SECONDS);
            change.get(10, TimeUnit.SECONDS);
            assertEquals(TaskCreationMode.ADVANCED, tasks.detail(project, created, owner.id()).creationMode());
            assertThrows(TaskConflictException.class, () -> tasks.create(project, owner.id(), command(TaskCreationMode.ADVANCED)));
        } finally { release.countDown(); }
    }

    @Test void conversionWaitsForChecklistTransactionAndCannotHideItsCommittedData() throws Exception {
        Account owner = account("raceconvert");
        UUID project = project(owner, "Concurrent conversion");
        UUID task = task(project, owner, "ADVANCED");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch added = new CountDownLatch(1), release = new CountDownLatch(1), started = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> writer = executor.submit(() -> tx.executeWithoutResult(status -> {
                checklist.add(project, task, owner.id(), "Concurrent data");
                added.countDown();
                await(release);
            }));
            assertTrue(added.await(10, TimeUnit.SECONDS));
            Future<?> convert = executor.submit(() -> {
                started.countDown();
                tasks.update(project, task, owner.id(), command(TaskCreationMode.SIMPLE));
            });
            try {
                assertTrue(started.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> convert.get(300, TimeUnit.MILLISECONDS));
            } finally { release.countDown(); }
            writer.get(10, TimeUnit.SECONDS);
            ExecutionException result = assertThrows(ExecutionException.class, () -> convert.get(10, TimeUnit.SECONDS));
            assertInstanceOf(TaskConflictException.class, result.getCause());
            assertEquals(TaskCreationMode.ADVANCED, tasks.detail(project, task, owner.id()).creationMode());
            assertEquals(1, checklist.list(project, task, owner.id()).size());
        } finally { release.countDown(); }
    }

    @ParameterizedTest @ValueSource(strings = {"LABEL", "CHILD", "ARCHIVED_CHILD", "RELATION_SOURCE", "RELATION_TARGET", "ATTACHMENT", "WORKLOG"})
    void conversionChecksRelatedTablesInsteadOfOnlyFormFields(String data) throws Exception {
        Account owner = account("stored");
        UUID project = project(owner, "Stored " + data);
        UUID task = task(project, owner, "ADVANCED");
        String base = tasksUrl(project) + "/" + task;
        switch (data) {
            case "LABEL" -> {
                String label = send(post("/api/v1/projects/" + project + "/labels"), owner, "{\"name\":\"Keep\",\"color\":\"blue\"}")
                        .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
                send(put(base + "/labels"), owner, "{\"labelIds\":[\"" + id(label) + "\"]}").andExpect(status().isOk());
            }
            case "CHILD", "ARCHIVED_CHILD" -> {
                UUID child = createTask(project, owner, "{\"title\":\"Child\",\"parentTaskId\":\"" + task + "\"}");
                if (data.equals("ARCHIVED_CHILD")) send(delete(tasksUrl(project) + "/" + child), owner, null).andExpect(status().isNoContent());
            }
            case "RELATION_SOURCE", "RELATION_TARGET" -> {
                UUID other = task(project, owner, "ADVANCED");
                String source = data.equals("RELATION_SOURCE") ? base : tasksUrl(project) + "/" + other;
                UUID target = data.equals("RELATION_SOURCE") ? other : task;
                send(post(source + "/relations"), owner, "{\"type\":\"RELATES\",\"targetTaskId\":\"" + target + "\"}").andExpect(status().isCreated());
            }
            case "ATTACHMENT" -> send(multipart(base + "/attachments")
                    .file(new org.springframework.mock.web.MockMultipartFile("file", "keep.txt", "text/plain", "Keep".getBytes())), owner, null)
                    .andExpect(status().isCreated());
            case "WORKLOG" -> send(post(base + "/worklogs"), owner, "{\"minutes\":30,\"workDate\":\"" + LocalDate.now() + "\"}").andExpect(status().isCreated());
            default -> throw new AssertionError(data);
        }
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_MODE_CONVERSION_BLOCKED"));
        read(base, owner).andExpect(jsonPath("$.creationMode").value("ADVANCED"));
    }

    @Test void closedPolicyDoesNotAllowEditingDeletingOrReorderingExistingAdvancedData() throws Exception {
        Account owner = account("readonly");
        UUID project = project(owner, "Read only advanced");
        UUID task = task(project, owner, "ADVANCED"), target = task(project, owner, "ADVANCED");
        String base = tasksUrl(project) + "/" + task;
        UUID item = id(send(post(base + "/checklist"), owner, "{\"text\":\"Keep\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String worklog = send(post(base + "/worklogs"), owner, "{\"minutes\":30,\"workDate\":\"" + LocalDate.now() + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID logId = UUID.fromString(JsonPath.read(worklog, "$.entries[0].id"));
        UUID attachment = id(send(multipart(base + "/attachments")
                .file(new org.springframework.mock.web.MockMultipartFile("file", "keep.txt", "text/plain", "Keep".getBytes())), owner, null)
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        String relation = send(post(base + "/relations"), owner, "{\"type\":\"RELATES\",\"targetTaskId\":\"" + target + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID relationId = UUID.fromString(JsonPath.read(relation, "$.relatesTo[0].relationId"));
        policy(project, owner, "SIMPLE");
        send(patch(base + "/checklist/" + item), owner, "{\"done\":true}").andExpect(status().isConflict());
        send(delete(base + "/checklist/" + item), owner, null).andExpect(status().isConflict());
        send(put(base + "/checklist/order"), owner, "{\"itemIds\":[\"" + item + "\"]}").andExpect(status().isConflict());
        send(patch(base + "/worklogs/" + logId), owner, "{\"minutes\":60,\"workDate\":\"" + LocalDate.now() + "\"}").andExpect(status().isConflict());
        send(delete(base + "/worklogs/" + logId), owner, null).andExpect(status().isConflict());
        send(delete(base + "/attachments/" + attachment), owner, null).andExpect(status().isConflict());
        send(delete(base + "/relations/" + relationId), owner, null).andExpect(status().isConflict());
        read(base + "/attachments/" + attachment + "/content", owner).andExpect(status().isOk()).andExpect(content().string("Keep"));
        read(base + "/checklist", owner).andExpect(jsonPath("$[0].done").value(false));
        read(base + "/worklogs", owner).andExpect(jsonPath("$.totalMinutes").value(30));
        read(base + "/relations", owner).andExpect(jsonPath("$.relatesTo.length()").value(1));
        read(tasksUrl(project) + "?creationMode=ADVANCED", owner).andExpect(jsonPath("$.totalElements").value(2));
    }

    private TaskCommand command(TaskCreationMode mode) {
        return new TaskCommand(new TaskDraft("Concurrent", null, TaskPriority.MEDIUM, null, null, null, null),
                null, null, null, null, null, mode, Set.of());
    }

    @Test void conversionPreservesClaimedPoolAndSimplePolicyAllowsExplicitCleanupWithoutRemovingPeople() throws Exception {
        Account owner = account("clearteam");
        UUID project = project(owner, "Pool cleanup");
        UUID team = id(send(post("/api/v1/projects/" + project + "/teams"), owner,
                "{\"name\":\"Pool team\",\"includeCreator\":true}").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        UUID task = createTask(project, owner, "{\"title\":\"Claimed\",\"pool\":{\"open\":true,\"teamId\":\"" + team + "\"}}");
        String base = tasksUrl(project) + "/" + task;
        send(post(base + "/claim"), owner, null).andExpect(status().isOk()).andExpect(jsonPath("$.pool.claimed").value(true));
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.pool.teamId").value(team.toString())).andExpect(jsonPath("$.pool.claimed").value(true));
        policy(project, owner, "SIMPLE");
        read(base, owner).andExpect(jsonPath("$.pool.teamId").value(team.toString())).andExpect(jsonPath("$.pool.claimed").value(true));
        send(patch(base), owner, update(",\"pool\":{\"open\":false,\"teamId\":null}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.pool.teamId").isEmpty()).andExpect(jsonPath("$.pool.claimed").value(false))
                .andExpect(jsonPath("$.assigneeIds[0]").value(owner.id().toString()));
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.creationMode").value("SIMPLE"));
    }

    @Test void simplePoolCanBeOpenedUpdatedAndConvertedWithoutDroppingAssignmentScope() throws Exception {
        Account owner = account("simplepool");
        UUID project = project(owner, "Shared pool");
        UUID team = id(send(post("/api/v1/projects/" + project + "/teams"), owner,
                "{\"name\":\"Shared team\",\"includeCreator\":true}").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        UUID task = task(project, owner, "SIMPLE");
        String base = tasksUrl(project) + "/" + task;
        policy(project, owner, "SIMPLE");
        send(patch(base), owner, update(",\"pool\":{\"open\":true,\"teamId\":\"" + team + "\"}")).andExpect(status().isOk());
        send(patch(base), owner, update(",\"pool\":{\"open\":true,\"teamId\":null}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.pool.open").value(true)).andExpect(jsonPath("$.pool.teamId").isEmpty());
        policy(project, owner, "BOTH");
        send(patch(base), owner, update(",\"creationMode\":\"ADVANCED\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.pool.open").value(true));
        send(patch(base), owner, update(",\"creationMode\":\"SIMPLE\"")).andExpect(status().isOk())
                .andExpect(jsonPath("$.pool.open").value(true));
        policy(project, owner, "ADVANCED");
        send(post(base + "/claim"), owner, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.creationMode").value("SIMPLE"));
        send(post(base + "/release"), owner, null).andExpect(status().isOk());
    }

    @Test void creationWaitingBehindPolicyChangeUsesCommittedPolicy() throws Exception {
        Account owner = account("raceclosed");
        UUID project = project(owner, "Policy first");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch changed = new CountDownLatch(1), release = new CountDownLatch(1), started = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newFixedThreadPool(2)) {
            Future<?> policy = executor.submit(() -> tx.executeWithoutResult(status -> {
                projects.changeTaskManagementMode(owner.id(), project, TaskManagementMode.SIMPLE);
                changed.countDown();
                await(release);
            }));
            assertTrue(changed.await(10, TimeUnit.SECONDS));
            Future<?> create = executor.submit(() -> {
                started.countDown();
                tasks.create(project, owner.id(), command(TaskCreationMode.ADVANCED));
            });
            try {
                assertTrue(started.await(10, TimeUnit.SECONDS));
                assertThrows(TimeoutException.class, () -> create.get(300, TimeUnit.MILLISECONDS));
            } finally { release.countDown(); }
            policy.get(10, TimeUnit.SECONDS);
            ExecutionException result = assertThrows(ExecutionException.class, () -> create.get(10, TimeUnit.SECONDS));
            assertInstanceOf(TaskConflictException.class, result.getCause());
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM tasks WHERE project_id=?", Integer.class, project));
        } finally { release.countDown(); }
    }

    @Test void staleProjectMetadataUpdateDoesNotOverwriteFounderPolicy() throws Exception {
        Account owner = account("metarace");
        UUID project = project(owner, "Metadata race");
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        CountDownLatch loaded = new CountDownLatch(1), release = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
            Future<?> metadata = executor.submit(() -> tx.executeWithoutResult(status -> {
                var entity = projects.detail(owner.id(), project);
                loaded.countDown();
                await(release);
                entity.updateDetails("Renamed", entity.getDescription(), entity.getPriority(), entity.getStartDate(),
                        entity.getTargetEndDate(), entity.getProjectGoal(), entity.getTechStack(), entity.getOrganizationId());
            }));
            assertTrue(loaded.await(10, TimeUnit.SECONDS));
            try { projects.changeTaskManagementMode(owner.id(), project, TaskManagementMode.SIMPLE); }
            finally { release.countDown(); }
            metadata.get(10, TimeUnit.SECONDS);
            var persisted = projects.detail(owner.id(), project);
            assertEquals(TaskManagementMode.SIMPLE, persisted.getTaskManagementMode());
            assertEquals("Renamed", persisted.getName());
        } finally { release.countDown(); }
    }
    private static void await(CountDownLatch latch) {
        try { if (!latch.await(10, TimeUnit.SECONDS)) throw new AssertionError("Transaction latch timed out"); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
    }
}
