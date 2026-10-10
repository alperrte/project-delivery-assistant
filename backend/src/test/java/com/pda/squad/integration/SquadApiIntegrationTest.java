package com.pda.squad.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.squad.application.service.SquadService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SquadApiIntegrationTest {

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
    }

    @Autowired MockMvc mvc;
    @Autowired UserAccounts users;
    @Autowired ProjectMembershipService memberships;
    @Autowired SquadService squadService;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;

    @Test
    void deletionRejectsAdminNonmemberRemovedAndDisabledAccountsAndWrongProjectOrCsrf() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("deletescope"), viewer = account("deleteviewer"), admin = account("deleteadmin");
        UUID project = createProject(manager, csrf, "Delete security scope");
        UUID otherProject = createProject(manager, csrf, "Other delete scope");
        UUID team = squadService.create(manager.id(), project, "Retained scoped team", null, null, true).getId();
        memberships.addMember(manager.id(), project, viewer.id(), Set.of(ProjectRole.TESTER));
        jdbc.update("UPDATE users SET global_role='ADMIN' WHERE id=?", admin.id());
        String path = "/api/v1/projects/" + project + "/teams/" + team;
        mvc.perform(get(path).cookie(viewer.access())).andExpect(status().isOk());
        for (Account denied : java.util.List.of(viewer, admin)) {
            mvc.perform(delete(path).cookie(csrf, denied.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get(path).cookie(admin.access())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + otherProject + "/teams/" + team)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        mvc.perform(delete(path).cookie(manager.access())).andExpect(status().isForbidden());
        memberships.removeMember(manager.id(), project, viewer.id());
        mvc.perform(get(path).cookie(viewer.access())).andExpect(status().isForbidden());
        mvc.perform(delete(path).cookie(csrf, viewer.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        jdbc.update("UPDATE users SET account_status='DISABLED' WHERE id=?", viewer.id());
        mvc.perform(delete(path).cookie(csrf, viewer.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isUnauthorized());
        org.junit.jupiter.api.Assertions.assertNull(jdbc.queryForObject("SELECT archived_at FROM squads WHERE id=?", java.time.OffsetDateTime.class, team));
        org.junit.jupiter.api.Assertions.assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM notifications WHERE resource_id=? AND type='SQUAD_DELETED'", Integer.class, team));
    }

    @Test
    void managerManagesSquadLifecycleWhileContributorOnlyViews() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("sqhttpmanager");
        Account contributor = account("sqhttpcontrib");
        UUID projectId = createProject(manager, csrf, "Squad HTTP project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        // Everyone belongs to at least one team, so the squad under test is never anyone else's last one.
        UUID anchor = squadService.create(manager.id(), projectId, "Anchor", null, null, true).getId();
        squadService.addMember(manager.id(), projectId, anchor, contributor.id());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Backend Squad\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(manager.access()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Backend Squad\"}"))
                .andExpect(status().isForbidden());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Backend Squad\",\"description\":\"Owns the API\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Backend Squad"))
                .andReturn().getResponse();
        UUID squadId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads").cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + squadId).cookie(contributor.access()))
                .andExpect(status().isOk());

        mvc.perform(put("/api/v1/projects/" + projectId + "/squads/" + squadId)
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Hijacked\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/projects/" + projectId + "/squads/" + squadId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed Squad\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Renamed Squad"));

        // Only an active project member can be added.
        Account outsider = account("sqhttpoutsider");
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + outsider.id() + "\"}"))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").value(contributor.id().toString()));
        // Duplicate add.
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + contributor.id() + "\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_MEMBER_EXISTS"));

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                        .cookie(contributor.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));

        mvc.perform(delete("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members/" + contributor.id())
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members/" + contributor.id())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());

        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/archive")
                        .cookie(csrf, contributor.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/archive")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads/" + squadId).cookie(manager.access()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void teamsStartEmptyRejectCyclesAndKeepEveryoneInAtLeastOneTeam() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("teamsmanager");
        Account member = account("teamsmember");
        UUID projectId = createProject(manager, csrf, "Teams hierarchy project");
        memberships.addMember(manager.id(), projectId, member.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        String base = "/api/v1/projects/" + projectId + "/teams";

        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        // No automatic team: the project starts without one.
        mvc.perform(get(base).cookie(member.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));

        // The first team always contains its creator, even when the request says otherwise.
        var parentCreated = mvc.perform(post(base)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Development\",\"includeCreator\":false}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.parentTeamId").doesNotExist())
                .andExpect(jsonPath("$.memberCount").value(1))
                .andExpect(jsonPath("$.updatedBy.userId").value(manager.id().toString()))
                .andExpect(jsonPath("$.memberPreview.length()").value(1))
                .andExpect(jsonPath("$.lastJoined.userId").value(manager.id().toString()))
                .andReturn().getResponse();
        UUID parentId = UUID.fromString(JsonPath.read(parentCreated.getContentAsString(), "$.id"));
        var childCreated = mvc.perform(post(base)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Backend\",\"parentTeamId\":\"" + parentId
                                + "\",\"includeCreator\":false}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.memberCount").value(0))
                .andExpect(jsonPath("$.lastJoined").doesNotExist()).andReturn().getResponse();
        UUID childId = UUID.fromString(JsonPath.read(childCreated.getContentAsString(), "$.id"));

        mvc.perform(put(base + "/" + parentId + "/parent")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"parentTeamId\":\"" + childId + "\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_CIRCULAR_PARENT"));
        mvc.perform(delete(base + "/" + parentId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_HAS_CHILDREN"));

        mvc.perform(post(base + "/" + childId + "/members")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + member.id() + "\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.otherTeams.length()").value(0));
        // The child is the only team of that member, so they cannot be taken out of it.
        mvc.perform(delete(base + "/" + childId + "/members/" + member.id())
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_LAST_MEMBERSHIP"));
        // Archiving the child would orphan them as well, and the response names who.
        mvc.perform(delete(base + "/" + childId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_ARCHIVE_WOULD_ORPHAN"))
                .andExpect(jsonPath("$.members.length()").value(1));

        // Leaving the project takes the team membership with it.
        memberships.removeMember(manager.id(), projectId, member.id());
        mvc.perform(get(base + "/" + childId + "/members").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(base + "/" + childId + "/candidates").param("q", member.nickname())
                        .cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].status").value("NONE"));
        mvc.perform(get(base + "/" + childId + "/candidates").param("q", "t").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete(base + "/" + childId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        // The manager is only in the parent team, so it cannot be archived either.
        mvc.perform(delete(base + "/" + parentId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("TEAM_ARCHIVE_WOULD_ORPHAN"));
    }

    @Test
    void nonMembersAreDeniedAndSquadIsScopedToItsOwnProject() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("sqhttpmanager2");
        Account outsider = account("sqhttpoutsider2");
        UUID projectId = createProject(manager, csrf, "Squad scope project");
        UUID otherProjectId = createProject(manager, csrf, "Other scope project");

        mvc.perform(get("/api/v1/projects/" + projectId + "/squads")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/projects/" + projectId + "/squads").cookie(outsider.access()))
                .andExpect(status().isForbidden());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Scoped Squad\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID squadId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        // Same manager, but the squad does not belong to otherProjectId.
        mvc.perform(get("/api/v1/projects/" + otherProjectId + "/squads/" + squadId).cookie(manager.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void teamMemberEmailsAreShownOnlyToThoseWhoManageMembers() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("emailmanager");
        Account contributor = account("emailcontrib");
        UUID projectId = createProject(manager, csrf, "Team emails project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.BACKEND_DEVELOPER));
        UUID teamId = squadService.create(manager.id(), projectId, "Mail team", null, null, true).getId();
        squadService.addMember(manager.id(), projectId, teamId, contributor.id());
        String members = "/api/v1/projects/" + projectId + "/teams/" + teamId + "/members";

        // The manager sees both addresses ...
        mvc.perform(get(members).cookie(manager.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].email").value(org.hamcrest.Matchers.containsString("@")))
                .andExpect(jsonPath("$.content[1].email").value(org.hamcrest.Matchers.containsString("@")));
        // ... an ordinary member sees the same people by nickname, with no address at all.
        mvc.perform(get(members).cookie(contributor.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].nickname").isNotEmpty())
                .andExpect(jsonPath("$.content[0].email").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.content[1].email").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test
    void teamListPreviewCarriesEnumOrderedProjectRolesWithoutEmails() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("rolemanager");
        Account contributor = account("rolecontrib");
        UUID projectId = createProject(manager, csrf, "Team roles project");
        memberships.addMember(manager.id(), projectId, contributor.id(), Set.of(ProjectRole.TESTER, ProjectRole.BACKEND_DEVELOPER));
        UUID teamId = squadService.create(manager.id(), projectId, "Role team", null, null, true).getId();
        squadService.addMember(manager.id(), projectId, teamId, contributor.id());
        String list = "/api/v1/projects/" + projectId + "/teams";

        // An ordinary member sees the newest member first with every role in enum order, and never an address.
        mvc.perform(get(list).cookie(contributor.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].memberPreview.length()").value(2))
                .andExpect(jsonPath("$.content[0].memberPreview[0].userId").value(contributor.id().toString()))
                .andExpect(jsonPath("$.content[0].memberPreview[0].roles[0]").value("BACKEND_DEVELOPER"))
                .andExpect(jsonPath("$.content[0].memberPreview[0].roles[1]").value("TESTER"))
                .andExpect(jsonPath("$.content[0].memberPreview[0].roles.length()").value(2))
                .andExpect(jsonPath("$.content[0].memberPreview[1].roles").isNotEmpty())
                .andExpect(jsonPath("$.content[0].memberPreview[*].roles[*]", org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.in(
                        java.util.Arrays.stream(ProjectRole.values()).map(Enum::name).toList()))))
                .andExpect(jsonPath("$.content[0].memberPreview[*].email").isEmpty());
        mvc.perform(get(list + "/" + teamId).cookie(manager.access())).andExpect(status().isOk())
                .andExpect(jsonPath("$.memberPreview[0].roles[0]").value("BACKEND_DEVELOPER"))
                .andExpect(jsonPath("$.memberPreview[0].email").doesNotExist());
    }

    @Test
    void teamRoutesNeverReachATeamOfAnotherProjectEvenForSomeoneWhoManagesBoth() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("teamscopemanager");
        Account outsider = account("teamscopeoutsider");
        UUID projectA = createProject(manager, csrf, "Team scope A");
        UUID projectB = createProject(manager, csrf, "Team scope B");
        var created = mvc.perform(post("/api/v1/projects/" + projectA + "/teams")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Team of A\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID teamOfA = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));
        String viaB = "/api/v1/projects/" + projectB + "/teams/" + teamOfA;

        // Read, edit, move, archive, list members and add a member: all answer 404 under the wrong project.
        mvc.perform(get(viaB).cookie(manager.access())).andExpect(status().isNotFound());
        mvc.perform(put(viaB).cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Renamed through B\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(put(viaB + "/parent").cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"parentTeamId\":null}"))
                .andExpect(status().isNotFound());
        mvc.perform(get(viaB + "/members").cookie(manager.access())).andExpect(status().isNotFound());
        mvc.perform(post(viaB + "/members").cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"userId\":\"" + manager.id() + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete(viaB).cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        // A team of project A cannot become the parent of a team in project B.
        mvc.perform(post("/api/v1/projects/" + projectB + "/teams").cookie(csrf, manager.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Child in B\",\"parentTeamId\":\"" + teamOfA + "\"}"))
                .andExpect(status().is4xxClientError());
        // Nothing above changed the team, and somebody who is in neither project reaches neither.
        mvc.perform(get("/api/v1/projects/" + projectA + "/teams/" + teamOfA).cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Team of A"));
        mvc.perform(get("/api/v1/projects/" + projectA + "/teams/" + teamOfA).cookie(outsider.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get(viaB).cookie(outsider.access())).andExpect(status().isForbidden());
    }

    @Test
    void everyContributorRoleIsDeniedEverySquadMutation() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("sqhttpmanager3");
        UUID projectId = createProject(manager, csrf, "Squad role matrix project");

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Matrix Squad\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID squadId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.id"));

        for (ProjectRole role : ProjectRole.values()) {
            if (role == ProjectRole.PROJECT_MANAGER) {
                continue;
            }
            Account holder = account("sqrole" + role.name().toLowerCase());
            memberships.addMember(manager.id(), projectId, holder.id(), Set.of(role));

            mvc.perform(post("/api/v1/projects/" + projectId + "/squads")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Denied Squad\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(put("/api/v1/projects/" + projectId + "/squads/" + squadId)
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Denied Rename\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/members")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"userId\":\"" + holder.id() + "\"}"))
                    .andExpect(status().isForbidden());
            mvc.perform(post("/api/v1/projects/" + projectId + "/squads/" + squadId + "/archive")
                            .cookie(csrf, holder.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isForbidden());
        }
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
        return new Account(id, access, "u" + suffix);
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

    private record Account(UUID id, Cookie access, String nickname) {
    }
}
