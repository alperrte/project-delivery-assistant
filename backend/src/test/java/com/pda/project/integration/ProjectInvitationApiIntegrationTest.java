package com.pda.project.integration;

import com.jayway.jsonpath.JsonPath;
import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

    @Test
    void externalInvitationRegistrationRequiresMatchingIdentityAndConsumesToken() throws Exception {
        Cookie csrf = csrfCookie();
        Account manager = account("externalmanager");
        UUID projectId = createProject(manager, csrf, "External API project");
        String email = "external-" + UUID.randomUUID() + "@example.test";
        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"firstName\":\"İrem\",\"lastName\":\"Öz\","
                                + "\"roles\":[\"TESTER\"],\"message\":\"Join us\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        String token = JsonPath.read(created.getContentAsString(), "$.token");

        mvc.perform(post("/api/v1/project-invitations/external/preview")
                        .cookie(csrf).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectName").value("External API project"))
                .andExpect(jsonPath("$.firstName").value("İrem"))
                .andExpect(jsonPath("$.message").value("Join us"));

        String nickname = "u" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String body = "{\"token\":\"" + token + "\",\"email\":\"" + email + "\",\"firstName\":\"İrem\","
                + "\"lastName\":\"Öz\",\"nickname\":\"" + nickname + "\","
                + "\"password\":\"password123\",\"confirmPassword\":\"password123\"}";
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
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
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
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, moderator.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(manager.access()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isForbidden());
        // Neither userId nor email set.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isBadRequest());

        var created = mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));
        String firstToken = JsonPath.read(created.getContentAsString(), "$.token");

        // Duplicate pending invitation for the same target.
        mvc.perform(post("/api/v1/projects/" + projectId + "/invitations")
                        .cookie(csrf, manager.access()).header("X-XSRF-TOKEN", csrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"ANALYST\"]}"))
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
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
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
                        .content("{\"userId\":\"" + claimant.id() + "\",\"roles\":[\"ANALYST\"]}"))
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
                        .content("{\"userId\":\"" + recipient.id() + "\",\"roles\":[\"TESTER\"]}"))
                .andExpect(status().isCreated()).andReturn().getResponse();
        UUID invitationId = UUID.fromString(JsonPath.read(created.getContentAsString(), "$.invitationId"));

        mvc.perform(get("/api/v1/project-invitations/me").cookie(recipient.access()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].id").value(invitationId.toString()));
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
                        .content("{\"userId\":\"" + target.id() + "\",\"roles\":[\"TESTER\"]}"))
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
