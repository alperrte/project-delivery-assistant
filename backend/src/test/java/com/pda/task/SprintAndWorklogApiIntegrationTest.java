package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SprintAndWorklogApiIntegrationTest extends TaskTestBase {
    private String sprintsUrl(UUID project) { return "/api/v1/projects/" + project + "/sprints"; }

    private String sprintBody(String name, int startOffset, int endOffset) {
        return "{\"name\":\"" + name + "\",\"goal\":\"Ship it\",\"startDate\":\"" + LocalDate.now().plusDays(startOffset)
                + "\",\"endDate\":\"" + LocalDate.now().plusDays(endOffset) + "\"}";
    }

    private UUID createSprint(UUID project, Account pm, String name) throws Exception {
        String body = send(post(sprintsUrl(project)), pm, sprintBody(name, -1, 14)).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLANNED")).andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    @Test void sprintLifecycleSingleActiveCompletionAndSummary() throws Exception {
        Account pm = account("sprintpm");
        UUID project = project(pm, "Sprint project");
        Account member = member(project, pm, "sprintm");
        Account outsider = account("sprintoutsider");
        String url = sprintsUrl(project);

        send(post(url), member, sprintBody("Nope", 0, 7)).andExpect(status().isForbidden());
        send(post(url), outsider, sprintBody("Nope", 0, 7)).andExpect(deniedToOutsider());
        send(post(url), pm, sprintBody("Backwards", 7, 0)).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("SPRINT_INVALID"));
        send(post(url), pm, "{\"name\":\"\",\"startDate\":\"2026-01-01\",\"endDate\":\"2026-01-02\"}")
                .andExpect(status().isBadRequest());
        mvc.perform(get(url)).andExpect(status().isUnauthorized());

        UUID one = createSprint(project, pm, "Sprint one");
        UUID two = createSprint(project, pm, "Sprint two");
        read(url, member).andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].name").value("Sprint two"));
        read(url + "?status=ACTIVE", member).andExpect(jsonPath("$.length()").value(0));

        UUID done = createTask(project, pm, "{\"title\":\"Finished\",\"sprintId\":\"" + one
                + "\",\"estimatePoints\":5,\"assigneeIds\":[\"" + member.id() + "\"]}");
        UUID open = createTask(project, pm, "{\"title\":\"Unfinished\",\"sprintId\":\"" + one + "\",\"estimatePoints\":3}");
        send(delete(url + "/" + one), pm, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SPRINT_NOT_EMPTY"));
        send(post(url + "/" + one + "/complete"), pm, "{\"moveOpenTasksTo\":\"BACKLOG\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SPRINT_NOT_ACTIVE"));

        send(post(url + "/" + one + "/start"), member, null).andExpect(status().isForbidden());
        send(post(url + "/" + one + "/start"), pm, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"));
        send(post(url + "/" + two + "/start"), pm, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SPRINT_ACTIVE_EXISTS"));
        send(post(url + "/" + one + "/start"), pm, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SPRINT_NOT_PLANNED"));

        for (String next : new String[]{"TODO", "IN_PROGRESS", "IN_REVIEW", "TESTING", "DONE"}) {
            send(patch(tasksUrl(project) + "/" + done + "/status"), pm, "{\"status\":\"" + next + "\"}")
                    .andExpect(status().isOk());
        }
        send(post(tasksUrl(project) + "/" + done + "/worklogs"), member, "{\"minutes\":90,\"workDate\":\""
                + LocalDate.now() + "\"}").andExpect(status().isCreated());
        read(url + "/" + one + "/summary", member).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTasks").value(2)).andExpect(jsonPath("$.doneTasks").value(1))
                .andExpect(jsonPath("$.totalPoints").value(8)).andExpect(jsonPath("$.donePoints").value(5))
                .andExpect(jsonPath("$.loggedMinutes").value(90))
                .andExpect(jsonPath("$.byStatus.DONE").value(1)).andExpect(jsonPath("$.burndown").isNotEmpty())
                .andExpect(jsonPath("$.burndown[-1:].remainingPoints").value(3));
        read(tasksUrl(project) + "?sprintId=" + one, member).andExpect(jsonPath("$.totalElements").value(2));

        send(post(url + "/" + one + "/complete"), pm, "{\"moveOpenTasksTo\":\"" + UUID.randomUUID() + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SPRINT_INVALID"));
        send(post(url + "/" + one + "/complete"), pm, "{\"moveOpenTasksTo\":\"" + one + "\"}")
                .andExpect(status().isBadRequest());
        send(post(url + "/" + one + "/complete"), pm, "{\"moveOpenTasksTo\":\"" + two + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        read(tasksUrl(project) + "/" + open, pm).andExpect(jsonPath("$.sprint.id").value(two.toString()));
        read(tasksUrl(project) + "/" + done, pm).andExpect(jsonPath("$.sprint.id").value(one.toString()));

        send(put(tasksUrl(project) + "/" + open + "/sprint"), pm, "{\"sprintId\":\"" + one + "\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SPRINT_COMPLETED"));
        send(patch(url + "/" + one), pm, sprintBody("Renamed", 0, 5)).andExpect(status().isConflict());
        send(put(tasksUrl(project) + "/" + open + "/sprint"), pm, "{\"sprintId\":null}").andExpect(status().isOk())
                .andExpect(jsonPath("$.sprint").doesNotExist());
        send(put(tasksUrl(project) + "/" + open + "/sprint"), member, "{\"sprintId\":null}")
                .andExpect(status().isForbidden());
        send(put(tasksUrl(project) + "/" + open + "/sprint"), pm, "{\"sprintId\":\"" + UUID.randomUUID() + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("SPRINT_INVALID"));

        send(patch(url + "/" + two), pm, sprintBody("Sprint two renamed", 1, 10)).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Sprint two renamed"));
        send(delete(url + "/" + two), pm, null).andExpect(status().isNoContent());
        read(url + "/" + two, pm).andExpect(status().isNotFound());
        read(url + "/" + UUID.randomUUID(), pm).andExpect(status().isNotFound());
    }

    @Test void worklogPermissionsValidationAndTotals() throws Exception {
        Account pm = account("logpm");
        UUID project = project(pm, "Worklog project");
        Account assignee = member(project, pm, "loga");
        Account bystander = member(project, pm, "logb");
        Account outsider = account("logoutsider");
        UUID task = createTask(project, pm, "{\"title\":\"Timed\",\"timeEstimateMinutes\":240,\"assigneeIds\":[\""
                + assignee.id() + "\"]}");
        String url = tasksUrl(project) + "/" + task + "/worklogs";
        String today = LocalDate.now().toString();

        send(post(url), bystander, "{\"minutes\":30,\"workDate\":\"" + today + "\"}").andExpect(status().isForbidden());
        send(post(url), outsider, "{\"minutes\":30,\"workDate\":\"" + today + "\"}").andExpect(deniedToOutsider());
        send(post(url), assignee, "{\"minutes\":0,\"workDate\":\"" + today + "\"}").andExpect(status().isBadRequest());
        send(post(url), assignee, "{\"minutes\":1441,\"workDate\":\"" + today + "\"}").andExpect(status().isBadRequest());
        send(post(url), assignee, "{\"minutes\":30,\"workDate\":\"" + LocalDate.now().plusDays(2) + "\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("WORKLOG_INVALID"));
        send(post(url), assignee, "{\"minutes\":30}").andExpect(status().isBadRequest());

        send(post(url), assignee, "{\"minutes\":45,\"workDate\":\"" + today + "\",\"note\":\"Setup\"}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.totalMinutes").value(45));
        String list = send(post(url), pm, "{\"minutes\":15,\"workDate\":\"" + LocalDate.now().minusDays(1) + "\"}")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.totalMinutes").value(60))
                .andReturn().getResponse().getContentAsString();
        UUID mine = UUID.fromString(JsonPath.<java.util.List<String>>read(list, "$.entries[?(@.minutes==45)].id").get(0));
        UUID others = UUID.fromString(JsonPath.<java.util.List<String>>read(list, "$.entries[?(@.minutes==15)].id").get(0));
        read(tasksUrl(project) + "/" + task, bystander).andExpect(jsonPath("$.loggedMinutes").value(60))
                .andExpect(jsonPath("$.timeEstimateMinutes").value(240));
        read(url, bystander).andExpect(jsonPath("$.entries.length()").value(2));

        send(patch(url + "/" + others), assignee, "{\"minutes\":20,\"workDate\":\"" + today + "\"}")
                .andExpect(status().isForbidden());
        send(patch(url + "/" + mine), assignee, "{\"minutes\":50,\"workDate\":\"" + today + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalMinutes").value(65));
        send(patch(url + "/" + mine), pm, "{\"minutes\":60,\"workDate\":\"" + today + "\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalMinutes").value(75));
        send(delete(url + "/" + others), assignee, null).andExpect(status().isForbidden());
        send(delete(url + "/" + mine), assignee, null).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalMinutes").value(15));
        send(delete(url + "/" + mine), assignee, null).andExpect(status().isNotFound());
        mvc.perform(get(url)).andExpect(status().isUnauthorized());

        send(delete(tasksUrl(project) + "/" + task), pm, null).andExpect(status().isNoContent());
        send(post(url), pm, "{\"minutes\":5,\"workDate\":\"" + today + "\"}").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TASK_ARCHIVED"));
    }
}
