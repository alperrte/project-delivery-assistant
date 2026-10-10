package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.shared.TestImages;
import com.pda.squad.application.service.SquadService;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(classes = BackendApplication.class)
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectInvitationApiIntegrationTest {

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
    @Autowired SquadService squads;
    @Autowired JdbcTemplate jdbc;

    private final Map<UUID, UUID> teamByProject = new HashMap<>();

    @Test
    void externalInvitationRegistrationRequiresMatchingIdentityAndConsumesToken() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("externalmanager");
        UUID projectId = createProject(manager, csrf, "External API project");
        String email = "external-" + UUID.randomUUID() + "@example.test";
        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"teamId\":\"" + team(projectId) + "\",\"email\":\"" + email + "\",\"firstName\":\"İrem\",\"lastName\":\"Öz\","
                                + "\"roles\":[\"TESTER\"],\"message\":\"Join us\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String token = JsonPath.read(created.getContentAsString(), "$.token");

        // An e-mail invitation has no target account yet; the manager history must still list it with its team.
        mvc.perform(get("/api/v1/projects/" + projectId + "/invitations/all?status=PENDING").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].teamName").isNotEmpty());

        mvc.perform(post("/api/v1/project-invitations/external/preview")
                        .cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectName").value("External API project"))
                .andExpect(jsonPath("$.firstName").value("İrem"))
                .andExpect(jsonPath("$.message").value("Join us"));

        String nickname = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String body = "{\"token\":\"" + token + "\",\"email\":\"" + email + "\",\"firstName\":\"İrem\","
                + "\"lastName\":\"Öz\",\"nickname\":\"" + nickname + "\","
                + "\"password\":\"Password-123\",\"confirmPassword\":\"Password-123\"}";
        mvc.perform(post("/api/v1/auth/register/invitation")
                        .cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("İrem", "Mehmet")))
                .andExpect(status().isBadRequest());
        assertTrue(users.findActiveByEmail(email).isEmpty());

        mvc.perform(post("/api/v1/auth/register/invitation")
                        .cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(projectId.toString()));
        assertTrue(users.findActiveByEmail(email).isPresent());

        mvc.perform(post("/api/v1/project-invitations/external/preview")
                        .cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void managerInvitesAndTargetAcceptsIntoMembership() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("invmanager");
        Account target = account("invtarget");
        UUID projectId = createProject(manager, csrf, "Invite HTTP project");

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));
        String token = JsonPath.read(created.getContentAsString(), "$.token");

        mvc.perform(get("/api/v1/projects/" + projectId + "/invitations").cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));

        // Wrong user cannot accept someone else's registered-target invitation.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isForbidden());
        // Wrong token is not found.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"not-the-token\"}"))
                .andExpect(status().isNotFound());

        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(target.id().toString()))
                .andExpect(jsonPath("$.roles[0]").value("TESTER"));

        mvc.perform(get("/api/v1/projects/" + projectId).cookie(target.access())).andExpect(status().isOk());
        // Already accepted: cannot be accepted or rejected again.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void onlyManagerCanCreateResendOrCancelAndCsrfIsRequired() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("invmanager2");
        Account moderator = account("invmoderator2");
        Account target = account("invtarget2");
        UUID projectId = createProject(manager, csrf, "Invite auth project");
        memberships.addMember(manager.id(), projectId, moderator.id(), Set.of(ProjectRole.TESTER));

        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, moderator.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(manager.access()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isForbidden());
        // Neither userId nor email set.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isBadRequest());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));
        String firstToken = JsonPath.read(created.getContentAsString(), "$.token");

        // Duplicate pending invitation for the same target.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"ANALYST\"]}"))
                .andExpect(status().isConflict());

        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/resend")
                        .cookie(csrf, moderator.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        var resent = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/resend")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isOk()).andReturn().getResponse();
        UUID resentId = UUID.fromString(JsonPath.read(resent.getContentAsString(), "$.invitationId"));
        String secondToken = JsonPath.read(resent.getContentAsString(), "$.token");
        assertNotEquals(firstToken, secondToken);

        // The cancelled original token no longer accepts.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + firstToken + "\"}"))
                .andExpect(status().isConflict());

        mvc.perform(delete("/api/v1/projects/" + projectId + "/invitations/" + resentId)
                        .cookie(csrf, moderator.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/invitations/" + resentId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/invitations/" + resentId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + resentId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + secondToken + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void invitedUserCanRejectAndOnlyRegisteredEmailRecipientCanAccept() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("invmanager3");
        Account target = account("invtarget3");
        UUID projectId = createProject(manager, csrf, "Invite reject project");

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));
        String token = JsonPath.read(created.getContentAsString(), "$.token");

        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/reject")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/reject")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/reject")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isConflict());

        Account claimant = account("invclaimant3");
        Account bystander = account("invbystander3");
        var emailInvite = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + claimant.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"ANALYST\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID emailInvitationId = UUID.fromString(JsonPath.read(emailInvite.getContentAsString(), "$.invitationId"));
        String emailToken = JsonPath.read(emailInvite.getContentAsString(), "$.token");

        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + emailInvitationId + "/accept")
                        .cookie(csrf, bystander.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + emailToken + "\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + emailInvitationId + "/accept")
                        .cookie(csrf, claimant.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + emailToken + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(claimant.id().toString()))
                .andExpect(jsonPath("$.roles[0]").value("ANALYST"));
    }

    @Test
    void recipientListsAndRejectsWithMessageWhileManagerCanSeeHistory() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("myinvmanager");
        Account recipient = account("myinvrecipient");
        Account outsider = account("myinvoutsider");
        UUID projectId = createProject(manager, csrf, "My invitation project");
        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + recipient.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));

        mvc.perform(get("/api/v1/project-invitations/me").cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(invitationId.toString()))
                .andExpect(jsonPath("$.content[0].teamName").value("Core"));
        String previewPath = "/api/v1/project-invitations/" + invitationId + "/preview";
        String logoPath = "/api/v1/project-invitations/" + invitationId + "/logo";
        mvc.perform(get(previewPath).cookie(recipient.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.projectId").value(projectId.toString()))
                .andExpect(jsonPath("$.name").value("My invitation project"))
                .andExpect(jsonPath("$.status").value("PLANNING"))
                .andExpect(jsonPath("$.memberCount").value(1))
                .andExpect(jsonPath("$.team").doesNotExist())
                .andExpect(jsonPath("$.members").doesNotExist());
        mvc.perform(get("/api/v1/projects/" + projectId).cookie(recipient.access()))
                .andExpect(status().isForbidden());
        mvc.perform(get(previewPath)).andExpect(status().isUnauthorized());
        mvc.perform(get(previewPath).cookie(outsider.access())).andExpect(status().isNotFound());
        mvc.perform(get(logoPath).cookie(outsider.access())).andExpect(status().isNotFound());
        mvc.perform(get(logoPath).cookie(recipient.access())).andExpect(status().isNotFound());
        byte[] png = TestImages.png(2, 2);
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/projects/" + projectId + "/logo")
                        .file(new MockMultipartFile("file", "logo.png", "image/png", png))
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get(previewPath).cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.logoVersion").isNumber());
        byte[] previewLogo = mvc.perform(get(logoPath).cookie(recipient.access()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(png, previewLogo);
        mvc.perform(get("/api/v1/project-invitations/me").cookie(outsider.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(post("/api/v1/project-invitations/" + invitationId + "/accept")
                        .cookie(csrf, outsider.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/project-invitations/" + invitationId + "/reject")
                        .cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Not available\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/projects/" + projectId + "/invitations/all").cookie(manager.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].status").value("REJECTED"))
                .andExpect(jsonPath("$.content[0].rejectionMessage").value("Not available"));
        // Answered invitations no longer open the project's card or logo.
        mvc.perform(get(previewPath).cookie(recipient.access())).andExpect(status().isNotFound());
        mvc.perform(get(logoPath).cookie(recipient.access())).andExpect(status().isNotFound());
    }

    @Test
    void anInvitationCannotBeAcceptedIntoAnArchivedProjectOrAfterItsInviterLeftTheManagement() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("lifecyclemanager");
        Account recipient = account("lifecyclerecipient");
        UUID archived = createProject(manager, csrf, "Archived before accept");
        UUID left = createProject(manager, csrf, "Inviter left before accept");
        UUID archivedInvitation = invite(manager, csrf, archived, "\"userId\":\"" + recipient.id() + "\"");
        UUID leftInvitation = invite(manager, csrf, left, "\"userId\":\"" + recipient.id() + "\"");

        // The project is archived after the invitation was sent: accepting must not create a membership in it.
        jdbc.update("UPDATE projects SET archived_at = now() WHERE id = ?", archived);
        mvc.perform(post("/api/v1/project-invitations/" + archivedInvitation + "/accept")
                        .cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM project_memberships WHERE project_id = ? AND user_id = ?",
                Integer.class, archived, recipient.id()));

        // The inviter is removed after sending: the roles they could give are no longer theirs to give.
        jdbc.update("UPDATE project_memberships SET status = 'REMOVED' WHERE project_id = ? AND user_id = ?",
                left, manager.id());
        mvc.perform(post("/api/v1/project-invitations/" + leftInvitation + "/accept")
                        .cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isConflict());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM project_memberships WHERE project_id = ? AND user_id = ?",
                Integer.class, left, recipient.id()));
    }

    @Test
    void theProjectPreviewAndLogoStopOpeningOnceTheInvitationIsCancelled() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("previewendmanager");
        Account recipient = account("previewendrecipient");
        UUID projectId = createProject(manager, csrf, "Preview ends with the invitation");
        UUID invitationId = invite(manager, csrf, projectId, "\"userId\":\"" + recipient.id() + "\"");
        mvc.perform(get("/api/v1/project-invitations/" + invitationId + "/preview").cookie(recipient.access()))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/v1/projects/" + projectId + "/invitations/" + invitationId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/project-invitations/" + invitationId + "/preview").cookie(recipient.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void theInvitedAccountSeesTheRealProjectBannerWithoutBecomingAMember() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("bannermanager");
        Account recipient = account("bannerrecipient");
        Account outsider = account("banneroutsider");
        Account member = account("bannermember");
        UUID projectId = createProject(manager, csrf, "Invitation banner project");
        UUID invitationId = invite(manager, csrf, projectId, "\"userId\":\"" + recipient.id() + "\"");
        memberships.addMember(manager.id(), projectId, member.id(), Set.of(ProjectRole.TESTER));
        String previewPath = "/api/v1/project-invitations/" + invitationId + "/preview";
        String bannerPath = "/api/v1/project-invitations/" + invitationId + "/banner";

        // No banner yet: the preview carries no version and the image route is not found.
        mvc.perform(get(previewPath).cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bannerVersion").doesNotExist());
        mvc.perform(get(bannerPath).cookie(recipient.access())).andExpect(status().isNotFound());

        byte[] png = TestImages.png(3, 2);
        mvc.perform(multipart(HttpMethod.PUT, "/api/v1/projects/" + projectId + "/banner")
                        .file(new MockMultipartFile("file", "banner.png", "image/png", png))
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get(previewPath).cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bannerVersion").isNumber());
        byte[] previewBanner = mvc.perform(get(bannerPath).cookie(recipient.access()))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"banner\""))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "private, no-store"))
                .andReturn().getResponse().getContentAsByteArray();
        assertArrayEquals(png, previewBanner);

        // The invitee is still not a member: the member-only routes stay closed.
        mvc.perform(get("/api/v1/projects/" + projectId + "/banner").cookie(recipient.access()))
                .andExpect(status().isForbidden());
        // Anyone but the invited account (a stranger, or a real member of the project) gets 404; anonymous gets 401.
        mvc.perform(get(bannerPath).cookie(outsider.access())).andExpect(status().isNotFound());
        mvc.perform(get(bannerPath).cookie(member.access())).andExpect(status().isNotFound());
        mvc.perform(get(bannerPath)).andExpect(status().isUnauthorized());
        // Only GET is open on the route (deny-by-default).
        mvc.perform(post(bannerPath).cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(delete(bannerPath).cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());
        mvc.perform(multipart(HttpMethod.PUT, bannerPath)
                        .file(new MockMultipartFile("file", "banner.png", "image/png", png))
                        .cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isForbidden());

        // An archived project is reported like a missing one.
        jdbc.update("UPDATE projects SET archived_at = now() WHERE id = ?", projectId);
        mvc.perform(get(bannerPath).cookie(recipient.access())).andExpect(status().isNotFound());
        mvc.perform(get(previewPath).cookie(recipient.access())).andExpect(status().isNotFound());
    }

    @Test
    void theInvitationBannerIsNotFoundOnceTheInvitationIsAnsweredOrTheProjectIsDeleted() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("bannerendmanager");
        Account recipient = account("bannerendrecipient");
        UUID answered = createProject(manager, csrf, "Banner ends when answered");
        UUID deleted = createProject(manager, csrf, "Banner ends when deleted");
        byte[] png = TestImages.png(2, 2);
        for (UUID projectId : new UUID[] {answered, deleted}) {
            mvc.perform(multipart(HttpMethod.PUT, "/api/v1/projects/" + projectId + "/banner")
                            .file(new MockMultipartFile("file", "banner.png", "image/png", png))
                            .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                    .andExpect(status().isNoContent());
        }
        UUID answeredInvitation = invite(manager, csrf, answered, "\"userId\":\"" + recipient.id() + "\"");
        UUID deletedInvitation = invite(manager, csrf, deleted, "\"userId\":\"" + recipient.id() + "\"");
        mvc.perform(get("/api/v1/project-invitations/" + answeredInvitation + "/banner").cookie(recipient.access()))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/project-invitations/" + answeredInvitation + "/reject")
                        .cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/project-invitations/" + answeredInvitation + "/banner").cookie(recipient.access()))
                .andExpect(status().isNotFound());

        mvc.perform(get("/api/v1/project-invitations/" + deletedInvitation + "/banner").cookie(recipient.access()))
                .andExpect(status().isOk());
        jdbc.update("DELETE FROM projects WHERE id = ?", deleted);
        mvc.perform(get("/api/v1/project-invitations/" + deletedInvitation + "/banner").cookie(recipient.access()))
                .andExpect(status().isNotFound());
    }

    @Test
    void myInvitationsListFiltersPendingReportsLapsedAsExpiredAndHidesArchivedProjectNames() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("mylistmanager");
        Account recipient = account("mylistrecipient");
        UUID live = createProject(manager, csrf, "Live invitation project");
        UUID lapsed = createProject(manager, csrf, "Lapsed invitation project");
        UUID rejected = createProject(manager, csrf, "Rejected invitation project");
        UUID archived = createProject(manager, csrf, "Archived invitation project");
        UUID liveInvitation = invite(manager, csrf, live, "\"email\":\"" + recipient.email() + "\"");
        UUID lapsedInvitation = invite(manager, csrf, lapsed, "\"userId\":\"" + recipient.id() + "\"");
        UUID rejectedInvitation = invite(manager, csrf, rejected, "\"userId\":\"" + recipient.id() + "\"");
        UUID archivedInvitation = invite(manager, csrf, archived, "\"userId\":\"" + recipient.id() + "\"");
        mvc.perform(post("/api/v1/project-invitations/" + rejectedInvitation + "/reject")
                        .cookie(csrf, recipient.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNoContent());
        jdbc.update("UPDATE project_invitations SET expires_at = ? WHERE id = ?",
                java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(60)), lapsedInvitation);
        jdbc.update("UPDATE projects SET archived_at = now() WHERE id = ?", archived);

        // Without a filter every invitation is listed: invited by e-mail or by id, a lapsed one reads as EXPIRED.
        String all = mvc.perform(get("/api/v1/project-invitations/me").cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4))
                .andReturn().getResponse().getContentAsString();
        assertEquals("PENDING", statusOf(all, liveInvitation));
        assertEquals("EXPIRED", statusOf(all, lapsedInvitation));
        assertEquals("REJECTED", statusOf(all, rejectedInvitation));
        // An archived project can no longer be joined, so its name is not reported.
        java.util.List<Object> archivedName = JsonPath.read(all,
                "$.content[?(@.id=='" + archivedInvitation + "')].projectName");
        assertEquals(1, archivedName.size());
        assertNull(archivedName.get(0));

        // Physical PENDING history remains, but archived projects are excluded from the incoming live list/count.
        mvc.perform(get("/api/v1/project-invitations/me?status=PENDING").cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[?(@.id=='" + liveInvitation + "')]").exists())
                .andExpect(jsonPath("$.content[?(@.id=='" + archivedInvitation + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id=='" + lapsedInvitation + "')]").doesNotExist())
                .andExpect(jsonPath("$.content[?(@.id=='" + rejectedInvitation + "')]").doesNotExist());
        mvc.perform(get("/api/v1/project-invitations/me?status=PENDING&page=0&size=1").cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(liveInvitation.toString()));
        mvc.perform(get("/api/v1/project-invitations/me?status=PENDING&size=1&userId=" + recipient.id())
                        .cookie(manager.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM project_invitations WHERE id=?",
                String.class, archivedInvitation));
        mvc.perform(get("/api/v1/project-invitations/me?status=ACCEPTED").cookie(recipient.access()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/project-invitations/me?status=PENDING")).andExpect(status().isUnauthorized());
    }

    @Test
    void invitationOperationsAreNotFoundUnderTheWrongProjectId() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("invmanager4");
        Account target = account("invtarget4");
        UUID projectId = createProject(manager, csrf, "Scoped invite project A");
        UUID otherProjectId = createProject(manager, csrf, "Scoped invite project B");

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));
        String token = JsonPath.read(created.getContentAsString(), "$.token");

        mvc.perform(post("/api/v1/projects/" + otherProjectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/projects/" + otherProjectId + "/invitations/" + invitationId + "/reject")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/projects/" + otherProjectId + "/invitations/" + invitationId + "/resend")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/projects/" + otherProjectId + "/invitations/" + invitationId)
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue()))
                .andExpect(status().isNotFound());

        // The correct project still accepts it: none of the wrong-project calls above mutated it.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations/" + invitationId + "/accept")
                        .cookie(csrf, target.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void invitationEndpointsAreRateLimitedPerIp() throws Exception {
        UUID projectId = UUID.randomUUID();
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/v1/projects/" + projectId + "/invitations").with(request -> {
                        request.setRemoteAddr("192.0.2.50");
                        return request;
                    }))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations").with(request -> {
                    request.setRemoteAddr("192.0.2.50");
                    return request;
                }))
                .andExpect(status().isTooManyRequests());
    }

    private UUID createProject(Account actor, Cookie csrf, String name) throws Exception {
        var response = mvc.perform(post("/api/v1/projects").cookie(csrf, actor.access())
                        .header("X-XSRF-TOKEN", csrf.getValue()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + name + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID projectId = UUID.fromString(JsonPath.read(response.getContentAsString(), "$.id"));
        teamByProject.put(projectId, squads.create(actor.id(), projectId, "Core", null, null, true).getId());
        return projectId;
    }

    private UUID team(UUID projectId) {
        return teamByProject.get(projectId);
    }

    /** Invites with the given identity JSON fragment (userId or email) into the project's first team. */
    private UUID invite(Account manager, Cookie csrf, UUID projectId, String identity) throws Exception {
        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + identity + ",\"teamId\":\"" + team(projectId) + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        return UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));
    }

    private static String statusOf(String page, UUID invitationId) {
        java.util.List<String> statuses = JsonPath.read(page, "$.content[?(@.id=='" + invitationId + "')].status");
        return statuses.get(0);
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
        return new Account(id, email, access);
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

    private record Account(UUID id, String email, Cookie access) {
    }
}
