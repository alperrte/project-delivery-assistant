package com.pda.project.application;

import com.pda.BackendApplication;
import com.pda.project.application.service.InvitationConflictException;
import com.pda.project.application.service.ProjectInvitationMailPort;
import com.pda.project.application.service.ProjectInvitationService;
import com.pda.project.application.service.ProjectInvitationService.CreatedInvitation;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.application.service.ProjectService;
import com.pda.project.application.service.MemberSummary;
import com.pda.project.domain.entity.ProjectInvitation;
import com.pda.project.domain.enums.InvitationStatus;
import com.pda.project.domain.enums.MembershipStatus;
import com.pda.user.ProjectRole;
import com.pda.project.infrastructure.repository.ProjectInvitationRepository;
import com.pda.project.infrastructure.repository.ProjectMembershipRepository;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest(classes = BackendApplication.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class ProjectInvitationServiceTest {

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

    @Autowired ProjectInvitationService invitationService;
    @Autowired ProjectInvitationRepository invitations;
    @Autowired ProjectMembershipRepository memberships;
    @Autowired ProjectService projectService;
    @Autowired ProjectMembershipService membershipService;
    @Autowired UserAccounts users;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean ProjectInvitationMailPort mailPort;

    @Test
    void managerCanInviteRegisteredUserAndOnlyTheTargetCanReject() {
        UUID manager = registerUser("manager");
        UUID target = registerUser("target");
        UUID projectId = projectService.create(manager, "Invite service project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER));
        assertNotNull(created.rawToken());
        assertEquals(InvitationStatus.PENDING, created.invitation().getStatus());
        assertEquals(1, invitationService.listPending(manager, projectId, PageRequest.of(0, 10)).getTotalElements());

        UUID invitationId = created.invitation().getId();
        assertThrows(AccessDeniedException.class, () -> invitationService.reject(manager, projectId, invitationId,
                created.rawToken()));
        assertThrows(NoSuchElementException.class, () -> invitationService.reject(target, projectId, invitationId,
                "not-the-real-token"));

        invitationService.reject(target, projectId, invitationId, created.rawToken());
        ProjectInvitation stored = invitations.findById(invitationId).orElseThrow();
        assertEquals(InvitationStatus.REJECTED, stored.getStatus());
        assertNotNull(stored.getRejectedAt());
        assertThrows(IllegalStateException.class, () -> invitationService.reject(target, projectId, invitationId,
                created.rawToken()));
    }

    @Test
    void duplicatePendingInvitationAndExistingMembershipAreRejected() {
        UUID manager = registerUser("manager2");
        UUID target = registerUser("target2");
        UUID projectId = projectService.create(manager, "Duplicate invite project", null, null).getId();

        invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER));
        assertThrows(InvitationConflictException.class, () -> invitationService.inviteRegisteredUser(manager,
                projectId, target, Set.of(ProjectRole.ANALYST)));

        UUID alreadyMember = registerUser("alreadymember");
        membershipService.addMember(manager, projectId, alreadyMember, Set.of(ProjectRole.TESTER));
        assertThrows(InvitationConflictException.class, () -> invitationService.inviteRegisteredUser(manager,
                projectId, alreadyMember, Set.of(ProjectRole.ANALYST)));
    }

    @Test
    void onlyManagerCanInviteResendOrCancelAndResendRotatesTheToken() {
        UUID manager = registerUser("manager3");
        UUID moderator = registerUser("moderator3");
        UUID target = registerUser("target3");
        UUID projectId = projectService.create(manager, "Authorization invite project", null, null).getId();
        membershipService.addMember(manager, projectId, moderator, Set.of(ProjectRole.TESTER));

        assertThrows(AccessDeniedException.class, () -> invitationService.inviteRegisteredUser(moderator, projectId,
                target, Set.of(ProjectRole.TESTER)));

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER));
        assertThrows(AccessDeniedException.class, () -> invitationService.cancel(moderator, projectId,
                created.invitation().getId()));
        assertThrows(AccessDeniedException.class, () -> invitationService.resend(moderator, projectId,
                created.invitation().getId()));

        CreatedInvitation resent = invitationService.resend(manager, projectId, created.invitation().getId());
        assertNotEquals(created.rawToken(), resent.rawToken());
        assertEquals(InvitationStatus.CANCELLED,
                invitations.findById(created.invitation().getId()).orElseThrow().getStatus());
        assertEquals(InvitationStatus.PENDING, resent.invitation().getStatus());

        invitationService.cancel(manager, projectId, resent.invitation().getId());
        assertEquals(InvitationStatus.CANCELLED,
                invitations.findById(resent.invitation().getId()).orElseThrow().getStatus());
        assertThrows(IllegalStateException.class, () -> invitationService.cancel(manager, projectId,
                resent.invitation().getId()));
    }

    @Test
    void emailInvitationRequiresRegisteredAccountAndOnlyRecipientMayReject() {
        UUID manager = registerUser("manager4");
        UUID projectId = projectService.create(manager, "Email invite project", null, null).getId();
        UUID target = registerUser("target4");
        String email = users.findActiveById(target).orElseThrow().email();

        assertThrows(NoSuchElementException.class, () -> invitationService.inviteByEmail(manager, projectId,
                "outside@example.test", Set.of(ProjectRole.ANALYST)));
        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId, email,
                Set.of(ProjectRole.ANALYST));
        assertEquals(target, created.invitation().getInvitedUserId());

        assertThrows(InvitationConflictException.class, () -> invitationService.inviteByEmail(manager, projectId,
                email, Set.of(ProjectRole.TESTER)));

        UUID anyLoggedInUser = registerUser("bystander4");
        assertThrows(AccessDeniedException.class, () -> invitationService.reject(anyLoggedInUser, projectId,
                created.invitation().getId(), created.rawToken()));
        invitationService.reject(target, projectId, created.invitation().getId(), created.rawToken());
        assertEquals(InvitationStatus.REJECTED,
                invitations.findById(created.invitation().getId()).orElseThrow().getStatus());
    }

    @Test
    void acceptingARegisteredUserInvitationCreatesMembershipAndOnlyTheTargetMayAccept() {
        UUID manager = registerUser("manager5");
        UUID target = registerUser("target5");
        UUID projectId = projectService.create(manager, "Accept invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER));
        UUID invitationId = created.invitation().getId();

        assertThrows(AccessDeniedException.class, () -> invitationService.accept(manager, projectId, invitationId,
                created.rawToken()));

        MemberSummary membership = invitationService.accept(target, projectId, invitationId,
                created.rawToken());
        assertEquals(Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER), membership.roles());
        assertEquals(MembershipStatus.ACTIVE,
                memberships.findByProjectIdAndUserId(projectId, target).orElseThrow().getStatus());
        assertEquals(InvitationStatus.ACCEPTED, invitations.findById(invitationId).orElseThrow().getStatus());
        assertNotNull(invitations.findById(invitationId).orElseThrow().getAcceptedAt());

        // Already ACCEPTED: cannot be accepted or rejected again.
        assertThrows(IllegalStateException.class, () -> invitationService.accept(target, projectId, invitationId,
                created.rawToken()));
        assertThrows(IllegalStateException.class, () -> invitationService.reject(target, projectId, invitationId,
                created.rawToken()));
    }

    @Test
    void acceptingAnEmailInvitationRequiresMatchingRecipientAndBlocksDoubleMembership() {
        UUID manager = registerUser("manager6");
        UUID projectId = projectService.create(manager, "Email accept project", null, null).getId();
        UUID claimant = registerUser("claimant6");
        String claimantEmail = users.findActiveById(claimant).orElseThrow().email();
        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId, claimantEmail,
                Set.of(ProjectRole.ANALYST));

        UUID bystander = registerUser("bystander6");
        assertThrows(AccessDeniedException.class, () -> invitationService.accept(bystander, projectId,
                created.invitation().getId(), created.rawToken()));
        MemberSummary membership = invitationService.accept(claimant, projectId, created.invitation().getId(),
                created.rawToken());
        assertEquals(claimant, membership.userId());
        assertEquals(Set.of(ProjectRole.ANALYST), membership.roles());

        UUID secondTarget = registerUser("second6");
        CreatedInvitation second = invitationService.inviteByEmail(manager, projectId,
                users.findActiveById(secondTarget).orElseThrow().email(),
                Set.of(ProjectRole.TESTER));
        assertThrows(AccessDeniedException.class, () -> invitationService.accept(claimant, projectId,
                second.invitation().getId(), second.rawToken()));
    }

    @Test
    void inviteAndResendSendMailWhenAvailableAndCreationSucceedsEvenWhenMailThrows() {
        Mockito.when(mailPort.available()).thenReturn(true);
        UUID manager = registerUser("mailmanager");
        UUID target = registerUser("mailtarget");
        UUID projectId = projectService.create(manager, "Mail invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER));
        Mockito.verify(mailPort).sendInvitation(Mockito.contains("mailtarget"), Mockito.eq("Mail invite project"),
                Mockito.contains(created.rawToken()));

        Mockito.reset(mailPort);
        Mockito.when(mailPort.available()).thenReturn(true);
        Mockito.doThrow(new RuntimeException("SMTP down")).when(mailPort)
                .sendInvitation(Mockito.anyString(), Mockito.anyString(), Mockito.anyString());

        // A mail transport failure must not break resend: the invitation itself is still rotated successfully.
        CreatedInvitation resent = invitationService.resend(manager, projectId, created.invitation().getId());
        assertEquals(InvitationStatus.PENDING, resent.invitation().getStatus());
        Mockito.verify(mailPort).sendInvitation(Mockito.anyString(), Mockito.anyString(), Mockito.anyString());
    }

    @Test
    void invitationCreationSucceedsWhenMailIsUnavailable() {
        Mockito.when(mailPort.available()).thenReturn(false);
        UUID manager = registerUser("nomailmanager");
        UUID target = registerUser("nomailtarget");
        UUID projectId = projectService.create(manager, "No mail project", null, null).getId();

        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId,
                users.findActiveById(target).orElseThrow().email(),
                Set.of(ProjectRole.ANALYST));
        assertEquals(InvitationStatus.PENDING, created.invitation().getStatus());
        Mockito.verify(mailPort, Mockito.never()).sendInvitation(Mockito.anyString(), Mockito.anyString(),
                Mockito.anyString());
    }

    @Test
    void expiredInvitationIsRejectedForAcceptRejectCancelAndResend() {
        UUID manager = registerUser("manager7");
        UUID target = registerUser("target7");
        UUID projectId = projectService.create(manager, "Expired invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER));
        UUID invitationId = created.invitation().getId();
        jdbc.update("UPDATE project_invitations SET expires_at = ? WHERE id = ?",
                java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(60)), invitationId);

        assertThrows(IllegalStateException.class, () -> invitationService.accept(target, projectId, invitationId,
                created.rawToken()));
        assertThrows(IllegalStateException.class, () -> invitationService.reject(target, projectId, invitationId,
                created.rawToken()));
        assertThrows(IllegalStateException.class, () -> invitationService.cancel(manager, projectId, invitationId));
        assertThrows(IllegalStateException.class, () -> invitationService.resend(manager, projectId, invitationId));
    }

    @Test
    void invitationOperationsAreScopedToTheirOwnProject() {
        UUID manager = registerUser("manager8");
        UUID target = registerUser("target8");
        UUID projectId = projectService.create(manager, "Scoped invite project A", null, null).getId();
        UUID otherProjectId = projectService.create(manager, "Scoped invite project B", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER));
        UUID invitationId = created.invitation().getId();

        assertThrows(NoSuchElementException.class, () -> invitationService.accept(target, otherProjectId,
                invitationId, created.rawToken()));
        assertThrows(NoSuchElementException.class, () -> invitationService.reject(target, otherProjectId,
                invitationId, created.rawToken()));
        assertThrows(NoSuchElementException.class, () -> invitationService.cancel(manager, otherProjectId,
                invitationId));
        assertThrows(NoSuchElementException.class, () -> invitationService.resend(manager, otherProjectId,
                invitationId));

        // The correct project still accepts it afterward: the wrong-project calls above never mutated it.
        invitationService.accept(target, projectId, invitationId, created.rawToken());
        assertEquals(InvitationStatus.ACCEPTED, invitations.findById(invitationId).orElseThrow().getStatus());
    }

    private UUID registerUser(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return users.registerLocal(prefix + suffix + "@example.test", prefix + "_" + suffix,
                UUID.randomUUID().toString());
    }
}
