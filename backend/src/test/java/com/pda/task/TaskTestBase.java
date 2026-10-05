package com.pda.task;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Shared harness of the task API tests: one PostgreSQL container and one Spring context for every subclass, plus
 * helpers for accounts, projects and CSRF-protected calls.
 */
@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
abstract class TaskTestBase {
    private static final byte[] JWT_KEY = new byte[32];
    static final PostgreSQLContainer postgres;

    static {
        new SecureRandom().nextBytes(JWT_KEY);
        postgres = new PostgreSQLContainer("postgres:17-alpine");
        if (org.testcontainers.DockerClientFactory.instance().isDockerAvailable()) postgres.start();
    }

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected UserAccounts users;
    @Autowired protected ProjectMembershipService memberships;

    protected record Account(UUID id, Cookie access) {}

    /** A CSRF-protected call as {@code who}; a null {@code body} sends no content type. */
    protected ResultActions send(AbstractMockHttpServletRequestBuilder<?> request, Account who, String body)
            throws Exception {
        Cookie csrf = csrf();
        request.cookie(csrf, who.access()).header("X-XSRF-TOKEN", csrf.getValue());
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(request);
    }

    protected ResultActions read(String url, Account who) throws Exception {
        return mvc.perform(get(url).cookie(who.access()));
    }

    protected UUID project(Account actor, String name) throws Exception {
        String body = send(post("/api/v1/projects"), actor, "{\"name\":\"" + name + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        UUID projectId = UUID.fromString(JsonPath.read(body, "$.id"));
        send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch(
                "/api/v1/projects/" + projectId + "/task-management-mode"), actor, "{\"mode\":\"BOTH\"}")
                .andExpect(status().isOk());
        return projectId;
    }

    protected String tasksUrl(UUID project) { return "/api/v1/projects/" + project + "/tasks"; }

    protected UUID createTask(UUID project, Account manager, String json) throws Exception {
        String body = send(post(tasksUrl(project)), manager, json).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    protected Account member(UUID project, Account manager, String prefix) throws Exception {
        Account account = account(prefix);
        memberships.addMember(manager.id(), project, account.id(), Set.of(ProjectRole.TESTER));
        return account;
    }

    protected Account account(String prefix) throws Exception {
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

    protected Cookie csrf() throws Exception {
        Cookie value = mvc.perform(get("/api/v1/auth/csrf")).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(value);
        return value;
    }

    /** 403 or 404: either way a non-member learns nothing about the project. */
    protected static org.springframework.test.web.servlet.ResultMatcher deniedToOutsider() {
        return result -> {
            int status = result.getResponse().getStatus();
            if (status != 403 && status != 404) throw new AssertionError("Expected 403 or 404 but was " + status);
        };
    }
}
