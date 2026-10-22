package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.user.ProjectRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class TaskAttributionAndOrderingIntegrationTest extends TaskTestBase {
    @Autowired JdbcTemplate jdbc;

    @Test void currentAssignmentsKeepEachActorAndRemovalDoesNotResurrectHistory() throws Exception {
        Account creator = account("source");
        UUID project = project(creator, "Assignment sources");
        Account manager = member(project, creator, "secondmanager");
        memberships.replaceRoles(creator.id(), project, manager.id(), Set.of(ProjectRole.PROJECT_MANAGER));
        Account a = member(project, creator, "recipienta");
        Account b = member(project, creator, "recipientb");
        UUID task = createTask(project, creator, "{\"title\":\"Actual sources\",\"assigneeIds\":[\"" + a.id() + "\"]}");
        String url = tasksUrl(project) + "/" + task;
        send(put(url + "/assignees"), manager, "{\"assigneeIds\":[\"" + a.id() + "\",\"" + b.id() + "\"]}").andExpect(status().isOk());
        String body = read(url, a).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertPair(body, a.id(), creator.id());
        assertPair(body, b.id(), manager.id());
        assertEquals(2, JsonPath.<List<?>>read(body, "$.assigners").size());

        // Ordinary edits cannot turn the latest editor into the source of an existing assignment.
        send(patch(url), manager, "{\"title\":\"Edited\",\"priority\":\"HIGH\"}").andExpect(status().isOk());
        assertPair(read(url, a).andReturn().getResponse().getContentAsString(), a.id(), creator.id());
        jdbc.update("update users set account_status='DISABLED' where id=?", creator.id());
        read(url, a).andExpect(status().isOk())
                .andExpect(jsonPath("$.assigners[?(@.userId=='" + creator.id() + "')].nickname").value(org.hamcrest.Matchers.contains((Object) null)));

        send(put(url + "/assignees"), manager, "{\"assigneeIds\":[\"" + b.id() + "\"]}").andExpect(status().isOk());
        read(url, b).andExpect(jsonPath("$.assigners.length()").value(1))
                .andExpect(jsonPath("$.assigners[0].userId").value(manager.id().toString()));
        read("/api/v1/tasks/mine?scope=ALL&projectId=" + project, a).andExpect(jsonPath("$.totalElements").value(0));
        read(tasksUrl(project), b).andExpect(jsonPath("$.content[0].assignmentDetails.length()").value(1));
        send(put(url + "/assignees"), manager, "{\"assigneeIds\":[]}").andExpect(status().isOk());
        read(url, b).andExpect(jsonPath("$.assigners.length()").value(0))
                .andExpect(jsonPath("$.assignmentDetails.length()").value(0));
        Account outsider = account("outside");
        read(url, outsider).andExpect(deniedToOutsider());
    }

    private void assertPair(String body, UUID user, UUID actor) {
        assertEquals(List.of(actor.toString()), JsonPath.<List<String>>read(body,
                "$.assignmentDetails[?(@.userId=='" + user + "')].assignedBy"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"updatedAt,asc", "updatedAt,desc", "deadlineAt,asc", "deadlineAt,desc", "priority,asc", "priority,desc"})
    void allOrderingIsGlobalStableFilteredAndPagedInPostgres(String sorting) throws Exception {
        Account actor = account("ordered");
        UUID first = project(actor, "First ordered");
        UUID second = project(actor, "Second ordered");
        // Same task numbers and timestamps across projects exercise the globally unique ID tie-breaker.
        bulkTasks(first, actor.id());
        bulkTasks(second, actor.id());
        Account other = account("foreign");
        UUID foreign = project(other, "Foreign ordered");
        bulkTasks(foreign, other.id());
        String[] parts = sorting.split(",");
        String field = parts[0];
        String direction = parts[1];
        String secondary = switch (field) {
            case "updatedAt" -> "updated_at";
            case "deadlineAt" -> "deadline_at";
            case "priority" -> "case priority when 'CRITICAL' then 3 when 'HIGH' then 2 when 'MEDIUM' then 1 else 0 end";
            default -> throw new AssertionError(field);
        };
        String nullOrder = field.equals("deadlineAt") ? "case when deadline_at is null then 1 else 0 end," : "";
        // Test SQL fragments are chosen solely from the fixed parameterized allowlist.
        String order = "case when status='DONE' then 1 else 0 end," + nullOrder + secondary + " " + direction + ", task_number desc,id asc";
        String endpoint = "/api/v1/tasks/mine?scope=ALL&sort=" + field + "&direction=" + direction;
        assertPages(actor, endpoint, "project_id in (?,?) and archived_at is null", order, first, second);
        assertPages(actor, endpoint + "&projectId=" + first, "project_id=? and archived_at is null", order, first);
        assertPages(actor, endpoint + "&status=IN_PROGRESS&status=DONE", "project_id in (?,?) and status in ('IN_PROGRESS','DONE') and archived_at is null", order, first, second);
        assertPages(actor, endpoint + "&status=DONE", "project_id in (?,?) and status='DONE' and archived_at is null", order, first, second);
        assertPages(actor, endpoint + "&status=TODO", "project_id in (?,?) and status='TODO' and archived_at is null", order, first, second);
        read(endpoint + "&projectId=" + foreign, actor).andExpect(jsonPath("$.totalElements").value(0));
        assertPages(actor, endpoint + "&overdue=true", "project_id in (?,?) and status<>'DONE' and deadline_at < now() and archived_at is null", order, first, second);
        // OPEN/DONE keep their existing secondary ordering (including null deadlines last).
        String existingOrder = nullOrder + secondary + " " + direction + ",task_number desc";
        assertPages(actor, endpoint.replace("scope=ALL", "scope=OPEN") + "&projectId=" + first,
                "project_id=? and status<>'DONE' and archived_at is null", existingOrder, first);
        assertPages(actor, endpoint.replace("scope=ALL", "scope=DONE") + "&projectId=" + first,
                "project_id=? and status='DONE' and archived_at is null", existingOrder, first);
        // Completion/reopening changes placement, totals and counts without changing ownership.
        UUID changed = jdbc.queryForObject("select id from tasks where project_id=? and status='IN_PROGRESS' order by id limit 1", UUID.class, first);
        send(patch(tasksUrl(first) + "/" + changed + "/status"), actor, "{\"status\":\"DONE\"}").andExpect(status().isOk());
        assertPages(actor, endpoint, "project_id in (?,?) and archived_at is null", order, first, second);
        read("/api/v1/tasks/counts", actor).andExpect(jsonPath("$.open").value(63));
        send(patch(tasksUrl(first) + "/" + changed + "/status"), actor, "{\"status\":\"IN_PROGRESS\"}").andExpect(status().isOk());
        assertPages(actor, endpoint, "project_id in (?,?) and archived_at is null", order, first, second);
        read("/api/v1/tasks/counts", actor).andExpect(jsonPath("$.open").value(64));
    }

    private void bulkTasks(UUID project, UUID actor) {
        // TEST-ONLY fixture: 64 rows per project, mixed statuses, deadlines (including null), priorities and ties.
        jdbc.update("""
                with inserted as (
                  insert into tasks(id,project_id,task_number,task_key,title,status,priority,created_by,created_at,updated_at,deadline_at)
                  select gen_random_uuid(),?,n,'TSF-'||?||'-'||n,'Ordered '||n,
                    case when n%2=0 then 'DONE' else 'IN_PROGRESS' end,
                    case n%4 when 0 then 'CRITICAL' when 1 then 'HIGH' when 2 then 'MEDIUM' else 'LOW' end,
                    ?,'2020-01-01T00:00:00Z','2020-01-01T00:00:00Z',
                    case when n%5=0 then null else '2020-01-01T00:00:00Z'::timestamptz + (n%3)*interval '1 hour' end
                  from generate_series(1,64) n returning id
                ) insert into task_assignments(id,task_id,user_id,assigned_by,assigned_at)
                  select gen_random_uuid(),id,?,?,'2020-01-01T00:00:00Z' from inserted
                """, project, project.toString(), actor, actor, actor);
    }

    private void assertPages(Account actor, String endpoint, String where, String order, Object... args) throws Exception {
        List<String> expected = jdbc.queryForList("select id from tasks where " + where + " order by " + order, UUID.class, args)
                .stream().map(UUID::toString).toList();
        List<String> actual = new ArrayList<>();
        int pages = (expected.size() + 19) / 20;
        for (int page = 0; page < Math.max(pages, 1); page++) {
            String body = read(endpoint + "&size=20&page=" + page, actor).andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(expected.size()))
                    .andExpect(jsonPath("$.totalPages").value(pages))
                    .andReturn().getResponse().getContentAsString();
            actual.addAll(JsonPath.<List<String>>read(body, "$.content[*].id"));
        }
        assertEquals(expected, actual);
        assertEquals(expected.size(), new HashSet<>(actual).size());
    }
}
