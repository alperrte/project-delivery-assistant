package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.task.infrastructure.TaskAssignmentRepository;
import com.pda.task.infrastructure.TaskRepository;
import com.pda.task.infrastructure.TaskKeyCounter;
import com.pda.task.domain.Task;
import com.pda.task.domain.TaskPriority;
import com.pda.task.application.TaskService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class TaskApiIntegrationTest {
    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("API_DOCS_ENABLED", () -> "true");
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;
    @Autowired TaskAssignmentRepository assignments;
    @Autowired TaskService tasks;
    @Autowired TaskRepository taskRepository;
    @Autowired TaskKeyCounter keyCounter;

    @Test void openApiExposesTaskContractWithoutSecretExamples() throws Exception {
        String document = mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertTrue(document.contains("/api/v1/projects/{projectId}/tasks"));
        assertTrue(document.contains("/api/v1/projects/{projectId}/tasks/{taskId}/history"));
        assertFalse(document.contains("PDA_ACCESS="));
        mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
    }

    @Test void archivedProjectRejectsCreateAndStaleTaskCannotOverwrite() throws Exception {
        Cookie csrf = csrf();
        Account manager = account("archived");
        Account outsider = account("archivedoutsider");
        UUID project = project(manager, csrf, "Archived task project");
        Task stale = tasks.create(project, manager.id(), "Original", null, null, null, null);
        tasks.update(project, stale.getId(), manager.id(), "Updated", null, TaskPriority.MEDIUM, null, null);
        assertThrows(ObjectOptimisticLockingFailureException.class, () -> taskRepository.saveAndFlush(stale));
        mvc.perform(post("/api/v1/projects/" + project + "/archive").cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/projects/" + project + "/tasks").cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Cannot create\"}"))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/projects/" + project + "/tasks").cookie(csrf, outsider.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Cannot learn archive state\"}"))
                .andExpect(status().isNotFound());
    }

    @Test void concurrentCreatesHaveUniqueNumbersAndKeys() throws Exception {
        Cookie csrf = csrf();
        Account manager = account("parallel");
        UUID project = project(manager, csrf, "Parallel task project");
        try (var executor = Executors.newFixedThreadPool(6)) {
            List<Future<String>> results = java.util.stream.IntStream.range(0, 6)
                    .mapToObj(i -> executor.submit(() -> tasks.create(project, manager.id(),
                            "Task " + i, null, null, null, null).getTaskKey())).toList();
            Set<String> keys = new java.util.HashSet<>();
            for (Future<String> result : results) keys.add(result.get());
            assertEquals(6, keys.size());
            assertTrue(keys.stream().allMatch(key -> key.startsWith("PARALLEL-TASK-PROJECT-")));
            String frozenPrefix = keys.iterator().next().replaceFirst("-\\d+$", "");
            assertEquals(frozenPrefix + "-7", keyCounter.next(project, "changed-slug").taskKey());
        }
    }

    @Test void lifecycleAuthorizationAndIsolation() throws Exception {
        Cookie csrf = csrf();
        Account manager = account("manager");
        Account contributor = account("contributor");
        Account outsider = account("outsider");
        UUID project = project(manager, csrf, "Task project");
        UUID other = project(manager, csrf, "Other task project");
        memberships.addMember(manager.id(), project, contributor.id(), Set.of(ProjectRole.TESTER));
        String base = "/api/v1/projects/" + project + "/tasks";

        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(post(base).cookie(manager.access()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"No CSRF\"}")).andExpect(status().isForbidden());
        mvc.perform(post(base).cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"No session\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(base).cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Cannot create\"}"))
                .andExpect(status().isForbidden());

        var created = mvc.perform(post(base).cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" First task \",\"priority\":\"HIGH\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.taskNumber").value(1))
                .andReturn().getResponse();
        UUID task = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        String key = JsonPath.read(created.getContentAsString(), "$.taskKey");
        assertTrue(key.startsWith("TASK-PROJECT-") && key.endsWith("-1"));
        mvc.perform(patch(base + "/" + task).cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Updated task\",\"priority\":\"CRITICAL\",\"startDate\":\"2026-10-01\",\"dueDate\":\"2026-10-03\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Updated task"))
                .andExpect(jsonPath("$.priority").value("CRITICAL"));
        mvc.perform(patch(base + "/" + task).cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Bad dates\",\"priority\":\"HIGH\",\"startDate\":\"2026-10-03\",\"dueDate\":\"2026-10-01\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/projects/" + other + "/tasks/" + task).cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get(base + "/" + task).cookie(outsider.access())).andExpect(status().isForbidden());
        mvc.perform(get(base + "?sort=id,asc").cookie(manager.access())).andExpect(status().isBadRequest());
        mvc.perform(get(base + "?size=101").cookie(manager.access())).andExpect(status().isBadRequest());
        mvc.perform(put(base + "/" + task + "/assignees").cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"assigneeIds\":[\"" + outsider.id() + "\"]}"))
                .andExpect(status().isBadRequest());

        String assigneesBody = "{\"assigneeIds\":[\"" + contributor.id() + "\",\""
                + contributor.id() + "\"]}";
        mvc.perform(put(base + "/" + task + "/assignees").cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content(assigneesBody)).andExpect(status().isOk());
        assertEquals(1, assignments.findByTaskId(task).size());
        mvc.perform(get(base + "/" + task).cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assigneeIds[0]").value(contributor.id().toString()));
        mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"DONE\"}")).andExpect(status().isConflict());
        mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"TODO\"}")).andExpect(status().isOk());
        mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"TODO\"}")).andExpect(status().isOk());
        mvc.perform(get(base + "/" + task + "/history").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].newStatus").value("TODO"))
                .andExpect(jsonPath("$.length()").value(1));

        mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isOk());
        mvc.perform(patch(base + "/" + task + "/blocked").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"blocked\":true,\"reason\":\"Awaiting API\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.blocked").value(true));
        mvc.perform(patch(base + "/" + task + "/blocked").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Missing blocked flag\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch(base + "/" + task + "/blocked").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"blocked\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.blocked").value(false));
        for (String next : new String[] {"IN_REVIEW", "TESTING", "DONE"}) {
            mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, contributor.access())
                    .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"status\":\"" + next + "\"}"))
                    .andExpect(status().isOk());
        }
        mvc.perform(patch(base + "/" + task + "/blocked").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"blocked\":true}"))
                .andExpect(status().isConflict());
        mvc.perform(get(base + "/" + task + "/history").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(5));

        memberships.removeMember(manager.id(), project, contributor.id());
        assertTrue(assignments.findByTaskId(task).isEmpty());
        mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, contributor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isForbidden());
        mvc.perform(delete(base + "/" + task).cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue())).andExpect(status().isNoContent());
        mvc.perform(get(base).cookie(manager.access())).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(patch(base + "/" + task + "/status").cookie(csrf, manager.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isConflict());
    }

    private UUID project(Account actor, Cookie csrf, String name) throws Exception {
        var response = mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return UUID.fromString(JsonPath.read(response.getContentAsString(), "$.id"));
    }
    private Account account(String prefix) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String email = prefix + suffix + "@example.test";
        String password = UUID.randomUUID().toString();
        UUID id = users.registerLocal(email, "u" + suffix, password);
        Cookie csrf = csrf();
        var response = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                .with(request -> { request.setRemoteAddr("task-" + suffix); return request; })
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
