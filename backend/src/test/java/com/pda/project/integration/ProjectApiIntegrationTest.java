package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.ProjectAccess;
import com.pda.project.application.service.MembershipConflictException;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.domain.enums.ProjectStatus;
import com.pda.user.ProjectPermission;
import com.pda.user.ProjectRole;
import com.pda.project.infrastructure.repository.ProjectRepository;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectApiIntegrationTest {

    private static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("FRONTEND_URL", () -> "http://localhost:3000");
        registry.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
        registry.add("API_DOCS_ENABLED", () -> "true");
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectRepository projects;
    @Autowired ProjectMembershipService memberships;
    @Autowired ProjectAccess projectAccess;
    @Autowired JdbcTemplate jdbc;

    @Test
    void creatorBecomesManagerAndCrossProjectAccessIsDenied() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("manager");
        Account outsider = account("outsider");

        mvc.perform(post("/api/v1/projects").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"No CSRF\"}"))
                .andExpect(status().isForbidden());
        var created = mvc.perform(post("/api/v1/projects").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Öğrenci Projesi\",\"description\":\"First project\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PLANNING"))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andReturn().getResponse();
        UUID projectId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        assertTrue(created.getHeader(HttpHeaders.LOCATION).endsWith(projectId.toString()));
        assertEquals("PROJECT_MANAGER", jdbc.queryForObject(
                "SELECT r.role FROM project_membership_roles r JOIN project_memberships m ON m.id = r.membership_id "
                        + "WHERE m.project_id = ? AND m.user_id = ?", String.class, projectId, manager.id()));

        mvc.perform(get("/api/v1/projects").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/projects"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/projects").cookie(outsider.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, outsider.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Taken\",\"priority\":\"HIGH\",\"status\":\"PLANNING\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/by-slug/" + JsonPath.read(created.getContentAsString(), "$.slug"))
                        .cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(projectId.toString()));

        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Updated\",\"priority\":\"HIGH\",\"status\":\"PLANNING\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.priority").value("HIGH"));
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(manager.access())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Unprotected\",\"priority\":\"HIGH\",\"status\":\"PLANNING\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/archive").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertNotNull(projects.findById(projectId).orElseThrow().getArchivedAt());
        assertFalse(projectAccess.isMember(projectId, manager.id()));
        assertTrue(projectAccess.rolesForUserInProject(projectId, manager.id()).isEmpty());
        mvc.perform(delete("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
    }

    @Test
    void organizationOwnerControlsMutationsAndProjectListUsesMembership() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("owner");
        Account other = account("other");
        var created = mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"PDA Team\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID organizationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        mvc.perform(put("/api/v1/organizations/" + organizationId).cookie(csrf, other.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Stolen\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/projects").cookie(csrf, other.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Wrong owner\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Linked\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/organizations/" + organizationId + "/projects").cookie(owner.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/v1/organizations/" + organizationId + "/projects").cookie(other.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/v1/organizations").cookie(owner.access())
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000"))
                .andExpect(status().isOk())
                .andExpect(result -> assertEquals("http://localhost:3000",
                        result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)));
        mvc.perform(post("/api/v1/organizations/" + organizationId + "/archive").cookie(csrf, other.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/organizations/" + organizationId + "/archive").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/organizations/" + organizationId).cookie(owner.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void aCoManagerCanEditAProjectLinkedToSomeoneElsesOrganizationButCannotLinkOneThatIsNotTheirs() throws Exception {
        Cookie csrf = csrfCookie();
        Account owner = account("orgowner2");
        Account coManager = account("comanager2");
        var created = mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Owned org\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID organizationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        var project = mvc.perform(post("/api/v1/projects").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Shared project\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID projectId = UUID.fromString(JsonPath.read(project.getContentAsString(), "$.id"));
        memberships.addMember(owner.id(), projectId, coManager.id(), Set.of(ProjectRole.PROJECT_MANAGER));

        // Saving the project as it is (same organization) is allowed for any manager of the project ...
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, coManager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Shared project renamed\",\"priority\":\"HIGH\",\"status\":\"PLANNING\",\"organizationId\":\"" + organizationId + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Shared project renamed"));

        // ... but linking the project to an organization the actor does not own is still refused.
        var foreign = mvc.perform(post("/api/v1/organizations").cookie(csrf, owner.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Another org\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID foreignId = UUID.fromString(JsonPath.read(foreign.getContentAsString(), "$.id"));
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, coManager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Shared project renamed\",\"priority\":\"HIGH\",\"status\":\"PLANNING\",\"organizationId\":\"" + foreignId + "\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void validationAndSwaggerExposeSafeContracts() throws Exception {
        Cookie csrf = csrfCookie();
        Account actor = account("validation");
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mvc.perform(get("/actuator/info")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.invalidFields[0]").value("name"));
        mvc.perform(get("/api/v1/projects?size=101").cookie(actor.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/v3/api-docs")).andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/projects'].post.responses['201']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/organizations'].post.responses['201']").exists())
                .andExpect(jsonPath("$.paths['/api/v1/projects/{projectId}/members'].get").exists());
    }

    @Test
    void statusTransitionsWorkThroughUpdateButArchivedIsRejected() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("statusmanager");
        UUID projectId = createProject(manager, csrf, "Status project");

        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Status project\",\"priority\":\"MEDIUM\",\"status\":\"ACTIVE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Status project\",\"priority\":\"MEDIUM\",\"status\":\"COMPLETED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        // Archiving only ever happens through the dedicated archive action, never via a settings update.
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Status project\",\"priority\":\"MEDIUM\",\"status\":\"ARCHIVED\"}"))
                .andExpect(status().isBadRequest());
        assertEquals(ProjectStatus.COMPLETED, projects.findById(projectId).orElseThrow().getStatus());

        mvc.perform(post("/api/v1/projects/" + projectId + "/archive").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Status project\",\"priority\":\"MEDIUM\",\"status\":\"ACTIVE\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void projectPermissionsFollowRolesPerProjectAndAnalystCannotManageTheProject() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("permmanager");
        Account analyst = account("permanalyst");
        Account tester = account("permtester");
        Account developer = account("permdeveloper");
        UUID projectId = createProject(manager, csrf, "Permission project");
        UUID otherProjectId = createProject(manager, csrf, "Other permission project");
        memberships.addMember(manager.id(), projectId, analyst.id(), Set.of(ProjectRole.ANALYST));
        memberships.addMember(manager.id(), projectId, tester.id(), Set.of(ProjectRole.TESTER));
        memberships.addMember(manager.id(), projectId, developer.id(), Set.of(ProjectRole.FULL_STACK_DEVELOPER));

        assertTrue(projectAccess.hasPermission(projectId, manager.id(), ProjectPermission.MEMBER_MANAGE));
        assertTrue(projectAccess.hasPermission(projectId, analyst.id(), ProjectPermission.TASK_WORK));
        assertFalse(projectAccess.hasPermission(projectId, analyst.id(), ProjectPermission.PROJECT_UPDATE));
        assertTrue(projectAccess.hasPermission(projectId, tester.id(), ProjectPermission.TEST_REPORT_WRITE));
        assertFalse(projectAccess.hasPermission(projectId, developer.id(), ProjectPermission.TEST_REPORT_WRITE));
        assertFalse(projectAccess.hasPermission(projectId, developer.id(), ProjectPermission.TASK_MANAGE));
        // A role in one project grants nothing in another one, and unknown input is denied.
        assertFalse(projectAccess.hasPermission(otherProjectId, analyst.id(), ProjectPermission.PROJECT_VIEW));
        assertTrue(projectAccess.permissionsForUserInProject(otherProjectId, tester.id()).isEmpty());
        assertFalse(projectAccess.hasPermission(projectId, UUID.randomUUID(), ProjectPermission.PROJECT_VIEW));
        assertFalse(projectAccess.hasPermission(projectId, manager.id(), null));

        for (Account denied : List.of(analyst, tester, developer)) {
            mvc.perform(put("/api/v1/projects/" + projectId).cookie(csrf, denied.access())
                            .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Hijacked\",\"priority\":\"HIGH\",\"status\":\"PLANNING\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/projects/" + projectId + "/archive").cookie(csrf, denied.access())
                            .header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(developer.access())).andExpect(status().isOk());
        assertNull(projects.findById(projectId).orElseThrow().getArchivedAt());
    }

    @Test
    void managerCanAssignRolesWhileAnalystAndContributorCannotManageMembers() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("rolemanager");
        Account analyst = account("analyst");
        Account contributor = account("contributor");
        UUID projectId = createProject(manager, csrf, "Membership roles");
        memberships.addMember(manager.id(), projectId, analyst.id(), Set.of(ProjectRole.ANALYST));
        memberships.addMember(manager.id(), projectId, contributor.id(),
                Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER));
        UUID otherProjectId = createProject(manager, csrf, "Other membership project");

        assertTrue(projectAccess.isMember(projectId, analyst.id()));
        assertEquals(Set.of("BACKEND_DEVELOPER", "TESTER"),
                projectAccess.rolesForUserInProject(projectId, contributor.id()));
        mvc.perform(get("/api/v1/projects/" + projectId + "/members").cookie(analyst.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/" + contributor.id())
                        .cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(contributor.id().toString()));
        mvc.perform(get("/api/v1/projects/" + otherProjectId + "/members").cookie(analyst.access()))
                .andExpect(status().isForbidden());
        assertFalse(projectAccess.canAccessProject(otherProjectId, analyst.id()));
        mvc.perform(post("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(csrf, analyst.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"PROJECT_MANAGER\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"PROJECT_MANAGER\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ANALYST\"}"))
                .andExpect(status().isOk());
        assertTrue(projectAccess.rolesForUserInProject(projectId, contributor.id()).contains("ANALYST"));
        mvc.perform(put("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("TESTER"));
        mvc.perform(post("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"UNKNOWN\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/members/" + contributor.id()
                        + "/roles/TESTER").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/projects/" + projectId + "/members/" + contributor.id() + "/roles")
                        .cookie(manager.access()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ANALYST\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/members/" + contributor.id())
                        .cookie(csrf, analyst.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/members/" + contributor.id())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        assertEquals("REMOVED", jdbc.queryForObject("SELECT status FROM project_memberships "
                + "WHERE project_id = ? AND user_id = ?", String.class, projectId, contributor.id()));
        assertFalse(projectAccess.canAccessProject(projectId, contributor.id()));
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(contributor.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects").cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(options("/api/v1/projects/" + projectId + "/members/" + contributor.id())
                        .header(HttpHeaders.ORIGIN, "http://localhost:3000")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "DELETE"))
                .andExpect(status().isOk())
                .andExpect(result -> assertEquals("http://localhost:3000",
                        result.getResponse().getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN)));
        assertThrows(MembershipConflictException.class,
                () -> memberships.addMember(manager.id(), projectId, analyst.id(), Set.of(ProjectRole.TESTER)));
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.TESTER));
        assertTrue(projectAccess.isMember(projectId, contributor.id()));
        assertEquals("ACTIVE", jdbc.queryForObject("SELECT status FROM project_memberships "
                + "WHERE project_id = ? AND user_id = ?", String.class, projectId, contributor.id()));
        for (ProjectRole role : ProjectRole.values()) {
            memberships.addRole(manager.id(), projectId, contributor.id(), role);
        }
        assertEquals(ProjectRole.values().length,
                projectAccess.rolesForUserInProject(projectId, contributor.id()).size());
    }

    @Test
    void managerCanSearchAddableUsersWhileOthersCannot() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("searchmanager");
        Account moderator = account("searchmoderator");
        UUID projectId = createProject(manager, csrf, "Search project");
        memberships.addMember(manager.id(), projectId, moderator.id(), Set.of(ProjectRole.TESTER));
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        UUID targetId = users.registerLocal("findable_" + suffix + "@example.test", "findable_" + suffix,
                UUID.randomUUID().toString());

        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=findable_" + suffix))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=findable_" + suffix)
                        .cookie(moderator.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=findable_" + suffix)
                        .cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value(targetId.toString()))
                .andExpect(jsonPath("$[0].nickname").value("findable_" + suffix))
                .andExpect(jsonPath("$[0].email").doesNotExist());
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=findable_" + suffix.toUpperCase())
                        .cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].userId").value(targetId.toString()));
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=findable_"
                        + suffix + "@example.test").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].userId").value(targetId.toString()));
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=a").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/v1/projects/" + projectId + "/members/search").cookie(manager.access()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void projectFounderCannotLeaveOrLoseManagerRoleWhileOtherManagersAreFree() throws Exception {
        Cookie csrf = csrfCookie();
        Account founder = account("lastmanager");
        Account second = account("secondmanager");
        UUID projectId = createProject(founder, csrf, "Founder rule");
        String memberPath = "/api/v1/projects/" + projectId + "/members/" + founder.id();

        mvc.perform(put(memberPath + "/roles").cookie(csrf, founder.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"ANALYST\"]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_OWNER_PROTECTED"));
        mvc.perform(delete(memberPath).cookie(csrf, founder.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_OWNER_PROTECTED"));
        mvc.perform(post(memberPath + "/roles").cookie(csrf, founder.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ANALYST\"}"))
                .andExpect(status().isOk());
        mvc.perform(delete(memberPath + "/roles/PROJECT_MANAGER").cookie(csrf, founder.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("PROJECT_OWNER_PROTECTED"));

        // A manager who did not found the project is not protected, even though the founder stays a manager.
        memberships.addMember(founder.id(), projectId, second.id(),
                Set.of(ProjectRole.PROJECT_MANAGER, ProjectRole.ANALYST));
        String secondPath = "/api/v1/projects/" + projectId + "/members/" + second.id();
        mvc.perform(delete(secondPath + "/roles/PROJECT_MANAGER").cookie(csrf, second.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.roles[0]").value("ANALYST"));
        assertEquals(Set.of("ANALYST"), projectAccess.rolesForUserInProject(projectId, second.id()));
        assertTrue(projectAccess.rolesForUserInProject(projectId, founder.id()).contains("PROJECT_MANAGER"));
    }

    @Test
    void concurrentManagerRemovalsLeaveOneManager() throws Exception {
        Cookie csrf = csrfCookie();
        Account first = account("concurrentfirst");
        Account second = account("concurrentsecond");
        UUID projectId = createProject(first, csrf, "Concurrent managers");
        memberships.addMember(first.id(), projectId, second.id(), Set.of(ProjectRole.PROJECT_MANAGER));

        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Future<String> firstResult = executor.submit(() -> removeSelfAfterStart(start, first.id(), projectId));
            Future<String> secondResult = executor.submit(() -> removeSelfAfterStart(start, second.id(), projectId));
            start.countDown();
            assertEquals(Set.of("removed", "blocked"), Set.of(
                    firstResult.get(10, TimeUnit.SECONDS), secondResult.get(10, TimeUnit.SECONDS)));
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM project_membership_roles r "
                + "JOIN project_memberships m ON m.id = r.membership_id "
                + "WHERE m.project_id = ? AND m.status = 'ACTIVE' AND r.role = 'PROJECT_MANAGER'",
                Long.class, projectId));
    }

    private String removeSelfAfterStart(CountDownLatch start, UUID actorId, UUID projectId)
            throws InterruptedException {
        start.await();
        try {
            memberships.removeMember(actorId, projectId, actorId);
            return "removed";
        } catch (MembershipConflictException exception) {
            return "blocked";
        }
    }

    @Test
    void everyContributorRoleIsDeniedMemberManagementAndMutationIsScopedToItsOwnProject() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("memmanager");
        Account target = account("memtarget");
        UUID projectId = createProject(manager, csrf, "Member role matrix project");
        UUID otherProjectId = createProject(manager, csrf, "Other member project");
        memberships.addMember(manager.id(), projectId, target.id(), Set.of(ProjectRole.TESTER));

        for (ProjectRole role : ProjectRole.values()) {
            if (role == ProjectRole.PROJECT_MANAGER) {
                continue;
            }
            Account holder = account("memrole" + role.name().toLowerCase());
            memberships.addMember(manager.id(), projectId, holder.id(), Set.of(role));

            mvc.perform(post("/api/v1/projects/" + projectId + "/members/" + target.id() + "/roles")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ANALYST\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/projects/" + projectId + "/members/" + target.id() + "/roles")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"ANALYST\"]}"))
                    .andExpect(status().isForbidden());
            mvc.perform(delete("/api/v1/projects/" + projectId + "/members/" + target.id())
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
            mvc.perform(get("/api/v1/projects/" + projectId + "/members/search?query=me")
                            .cookie(holder.access()))
                    .andExpect(status().isForbidden());
        }

        // Manager of project A is not a manager of project B: mutation is rejected, not just misrouted.
        mvc.perform(post("/api/v1/projects/" + otherProjectId + "/members/" + target.id() + "/roles")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"ANALYST\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/projects/" + otherProjectId + "/members/" + target.id())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
    }

    private UUID createProject(Account actor, Cookie csrf, String name) throws Exception {
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
        Cookie csrf = csrfCookie();
        var login = mvc.perform(post("/api/v1/auth/login").cookie(csrf)
                        .with(request -> { request.setRemoteAddr("test-" + suffix); return request; })
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse();
        Cookie access = cookie(login.getHeaders(HttpHeaders.SET_COOKIE), "PDA_ACCESS");
        assertFalse(access.getValue().isBlank());
        return new Account(id, access);
    }

    private Cookie csrfCookie() throws Exception {
        Cookie cookie = mvc.perform(get("/api/v1/auth/csrf"))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertNotNull(cookie);
        return cookie;
    }

    private static Cookie cookie(java.util.Collection<String> headers, String name) {
        String value = headers.stream().filter(header -> header.startsWith(name + "="))
                .findFirst().orElseThrow().split(";", 2)[0].substring(name.length() + 1);
        return new Cookie(name, value);
    }

    private record Account(UUID id, Cookie access) {
    }
}
