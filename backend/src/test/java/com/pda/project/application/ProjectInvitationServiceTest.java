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
import com.pda.squad.application.service.SquadService;
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
import java.util.List;
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
    @Autowired SquadService squadService;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.pda.project.ProjectAccess access;
    @Autowired javax.sql.DataSource dataSource;
    @MockitoBean ProjectInvitationMailPort mailPort;

    @Test
    void managerCanInviteRegisteredUserAndOnlyTheTargetCanReject() {
        UUID manager = registerUser("manager");
        UUID target = registerUser("target");
        UUID projectId = projectService.create(manager, "Invite service project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));
        assertNotNull(created.rawToken());
        assertEquals(InvitationStatus.PENDING, created.invitation().getStatus());
        assertEquals(1, invitationService.listPending(manager, projectId, PageRequest.of(0, 10)).getTotalElements());
        var display = invitationService.listPending(manager, projectId, PageRequest.of(0, 10)).getContent().getFirst();
        assertEquals(users.findActiveById(manager).orElseThrow().nickname(), display.invitedByNickname());
        assertEquals(users.findActiveById(target).orElseThrow().nickname(), display.nickname());
        assertNull(display.invitedByPhotoVersion());
        assertNull(display.profilePhotoVersion());

        UUID invitationId = created.invitation().getId();
        assertThrows(AccessDeniedException.class, () -> invitationService.reject(manager, projectId, invitationId,
                created.rawToken()));
        assertThrows(NoSuchElementException.class, () -> invitationService.reject(target, projectId, invitationId,
                "not-the-real-token"));

        invitationService.reject(target, projectId, invitationId, created.rawToken());
        ProjectInvitation stored = invitations.findById(invitationId).orElseThrow();
        assertEquals(InvitationStatus.REJECTED, stored.getStatus());
        assertNotNull(stored.getRejectedAt());
        assertEquals(InvitationConflictException.NOT_PENDING, assertThrows(InvitationConflictException.class, () -> invitationService.reject(target, projectId, invitationId,
                created.rawToken())).code());
    }

    @Test
    void duplicatePendingInvitationAndExistingMembershipAreRejected() {
        UUID manager = registerUser("manager2");
        UUID target = registerUser("target2");
        UUID projectId = projectService.create(manager, "Duplicate invite project", null, null).getId();

        invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));
        assertEquals(InvitationConflictException.ALREADY_PENDING, assertThrows(InvitationConflictException.class, () -> invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.ANALYST), null, team(projectId))).code());

        UUID alreadyMember = registerUser("alreadymember");
        membershipService.addMember(manager, projectId, alreadyMember, Set.of(ProjectRole.TESTER));
        assertEquals(InvitationConflictException.TARGET_ALREADY_MEMBER, assertThrows(InvitationConflictException.class, () -> invitationService.inviteRegisteredUser(manager, projectId, alreadyMember, Set.of(ProjectRole.ANALYST), null, team(projectId))).code());
    }

    @Test
    void onlyManagerCanInviteResendOrCancelAndResendRotatesTheToken() {
        UUID manager = registerUser("manager3");
        UUID moderator = registerUser("moderator3");
        UUID target = registerUser("target3");
        UUID projectId = projectService.create(manager, "Authorization invite project", null, null).getId();
        membershipService.addMember(manager, projectId, moderator, Set.of(ProjectRole.TESTER));

        assertThrows(AccessDeniedException.class, () -> invitationService.inviteRegisteredUser(moderator, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId)));

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));
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
        assertEquals(InvitationConflictException.NOT_PENDING, assertThrows(InvitationConflictException.class, () -> invitationService.cancel(manager, projectId,
                resent.invitation().getId())).code());
    }

    @Test
    void emailInvitationFindsRegisteredAccountAndOnlyRecipientMayReject() {
        UUID manager = registerUser("manager4");
        UUID projectId = projectService.create(manager, "Email invite project", null, null).getId();
        UUID target = registerUser("target4");
        String email = users.findActiveById(target).orElseThrow().email();

        assertThrows(IllegalArgumentException.class, () -> invitationService.inviteByEmail(manager, projectId, "outside@example.test", null, null, Set.of(ProjectRole.ANALYST), null, team(projectId)));
        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId, email, null, null, Set.of(ProjectRole.ANALYST), null, team(projectId));
        assertEquals(target, created.invitation().getInvitedUserId());

        assertEquals(InvitationConflictException.ALREADY_PENDING, assertThrows(InvitationConflictException.class, () -> invitationService.inviteByEmail(manager, projectId, email, null, null, Set.of(ProjectRole.TESTER), null, team(projectId))).code());

        UUID anyLoggedInUser = registerUser("bystander4");
        assertThrows(AccessDeniedException.class, () -> invitationService.reject(anyLoggedInUser, projectId,
                created.invitation().getId(), created.rawToken()));
        invitationService.reject(target, projectId, created.invitation().getId(), created.rawToken());
        assertEquals(InvitationStatus.REJECTED,
                invitations.findById(created.invitation().getId()).orElseThrow().getStatus());
    }

    @Test
    void externalInvitationPreviewAndRegistrationCreateMembershipOnce() {
        UUID manager = registerUser("externalmanager");
        UUID projectId = projectService.create(manager, "External project", null, null).getId();
        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId, " Outside@example.test ", "Ahmet", "Yılmaz", Set.of(ProjectRole.TESTER), "Join us", team(projectId));
        assertNull(created.invitation().getInvitedUserId());
        assertEquals("outside@example.test", created.invitation().getEmail());
        assertEquals("Join us", invitationService.preview(created.rawToken()).message());
        assertThrows(NoSuchElementException.class, () -> invitationService.preview("wrong-token"));
        assertEquals(0L, notificationCount(created.invitation().getId(), "PROJECT_INVITATION_CREATED"));

        UUID target = users.registerInvitedLocal("outside@example.test", "outside_user", "password123",
                "Ahmet", "Yılmaz");
        assertThrows(IllegalArgumentException.class, () -> invitationService.acceptNewAccount(created.rawToken(),
                target, "outside@example.test", "Mehmet", "Yılmaz"));
        invitationService.acceptNewAccount(created.rawToken(), target, "outside@example.test", "ahmet", "YILMAZ");
        assertEquals(InvitationStatus.ACCEPTED,
                invitations.findById(created.invitation().getId()).orElseThrow().getStatus());
        assertEquals(Set.of("TESTER"), membershipRoles(projectId, target));
        assertEquals(1L, notificationCount(created.invitation().getId(), "PROJECT_INVITATION_ACCEPTED"));
        assertEquals("External project", jdbc.queryForObject("SELECT invitation_project_name FROM notifications "
                + "WHERE resource_id=? AND type='PROJECT_INVITATION_ACCEPTED'", String.class, created.invitation().getId()));
        assertThrows(NoSuchElementException.class, () -> invitationService.preview(created.rawToken()));
        assertThrows(NoSuchElementException.class, () -> invitationService.acceptExistingAccount(created.rawToken(), target));
    }

    @Test
    void externalInviteCanBeAcceptedByMatchingAccountCreatedAfterInviteAndResendRotatesToken() {
        UUID manager = registerUser("racemanager");
        UUID projectId = projectService.create(manager, "Race project", null, null).getId();
        String email = "race-" + UUID.randomUUID() + "@example.test";
        CreatedInvitation first = invitationService.inviteByEmail(manager, projectId, email, "İrem", "Öz", Set.of(ProjectRole.BACKEND_DEVELOPER), null, team(projectId));
        CreatedInvitation resent = invitationService.resend(manager, projectId, first.invitation().getId());
        assertNotEquals(first.rawToken(), resent.rawToken());
        assertThrows(NoSuchElementException.class, () -> invitationService.preview(first.rawToken()));

        UUID account = users.registerLocal(email, "race_" + UUID.randomUUID().toString().substring(0, 8),
                "password123");
        UUID other = registerUser("raceother");
        assertThrows(AccessDeniedException.class, () -> invitationService.acceptExistingAccount(resent.rawToken(), other));
        invitationService.acceptExistingAccount(resent.rawToken(), account);
        assertEquals(Set.of("BACKEND_DEVELOPER"), membershipRoles(projectId, account));
        assertEquals("Race project", jdbc.queryForObject("SELECT invitation_project_name FROM notifications "
                + "WHERE resource_id=? AND type='PROJECT_INVITATION_ACCEPTED'", String.class, resent.invitation().getId()));
        assertThrows(NoSuchElementException.class, () -> invitationService.acceptExistingAccount(resent.rawToken(), account));
    }

    @Test
    void acceptingARegisteredUserInvitationCreatesMembershipAndOnlyTheTargetMayAccept() {
        UUID manager = registerUser("manager5");
        UUID target = registerUser("target5");
        UUID projectId = projectService.create(manager, "Accept invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.BACKEND_DEVELOPER, ProjectRole.TESTER), null, team(projectId));
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
        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId, claimantEmail, null, null, Set.of(ProjectRole.ANALYST), null, team(projectId));

        UUID bystander = registerUser("bystander6");
        assertThrows(AccessDeniedException.class, () -> invitationService.accept(bystander, projectId,
                created.invitation().getId(), created.rawToken()));
        MemberSummary membership = invitationService.accept(claimant, projectId, created.invitation().getId(),
                created.rawToken());
        assertEquals(claimant, membership.userId());
        assertEquals(Set.of(ProjectRole.ANALYST), membership.roles());

        UUID secondTarget = registerUser("second6");
        CreatedInvitation second = invitationService.inviteByEmail(manager, projectId, users.findActiveById(secondTarget).orElseThrow().email(), null, null, Set.of(ProjectRole.TESTER), null, team(projectId));
        assertThrows(AccessDeniedException.class, () -> invitationService.accept(claimant, projectId,
                second.invitation().getId(), second.rawToken()));
    }

    @Test
    void inviteAndResendSendMailWhenAvailableAndCreationSucceedsEvenWhenMailThrows() {
        Mockito.when(mailPort.available()).thenReturn(true);
        UUID manager = registerUser("mailmanager");
        UUID target = registerUser("mailtarget");
        UUID projectId = projectService.create(manager, "Mail invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));
        Mockito.verify(mailPort).sendInvitation(Mockito.contains("mailtarget"), Mockito.eq("Mail invite project"),
                Mockito.anyString(), Mockito.anyString(), Mockito.anySet(), Mockito.isNull(), Mockito.any(),
                Mockito.contains(created.rawToken()));

        Mockito.reset(mailPort);
        Mockito.when(mailPort.available()).thenReturn(true);
        Mockito.doThrow(new RuntimeException("SMTP down")).when(mailPort)
                .sendInvitation(Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.anyString(),
                        Mockito.anySet(), Mockito.isNull(), Mockito.any(), Mockito.anyString());

        // A mail transport failure must not break resend: the invitation itself is still rotated successfully.
        CreatedInvitation resent = invitationService.resend(manager, projectId, created.invitation().getId());
        assertEquals(InvitationStatus.PENDING, resent.invitation().getStatus());
        Mockito.verify(mailPort).sendInvitation(Mockito.anyString(), Mockito.anyString(), Mockito.anyString(), Mockito.anyString(),
                Mockito.anySet(), Mockito.isNull(), Mockito.any(), Mockito.anyString());
    }

    @Test
    void registeredUserInvitationMailLinksToTheRealInvitationRoute() {
        Mockito.when(mailPort.available()).thenReturn(true);
        UUID manager = registerUser("linkmanager");
        UUID target = registerUser("linktarget");
        UUID projectId = projectService.create(manager, "Link invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));

        // The frontend route is /invitations/{projectId}/{invitationId}; any other shape is a 404 for the recipient.
        String expected = "http://localhost:3000/invitations/" + projectId + "/" + created.invitation().getId()
                + "?token=" + created.rawToken();
        Mockito.verify(mailPort).sendInvitation(Mockito.anyString(), Mockito.anyString(), Mockito.anyString(),
                Mockito.anyString(), Mockito.anySet(), Mockito.isNull(), Mockito.any(), Mockito.eq(expected));
    }

    @Test
    void invitationCreationSucceedsWhenMailIsUnavailable() {
        Mockito.when(mailPort.available()).thenReturn(false);
        UUID manager = registerUser("nomailmanager");
        UUID target = registerUser("nomailtarget");
        UUID projectId = projectService.create(manager, "No mail project", null, null).getId();

        CreatedInvitation created = invitationService.inviteByEmail(manager, projectId, users.findActiveById(target).orElseThrow().email(), null, null, Set.of(ProjectRole.ANALYST), null, team(projectId));
        assertEquals(InvitationStatus.PENDING, created.invitation().getStatus());
        Mockito.verify(mailPort, Mockito.never()).sendInvitation(Mockito.anyString(), Mockito.anyString(),
                Mockito.anyString(), Mockito.anyString(), Mockito.anySet(), Mockito.isNull(), Mockito.any(), Mockito.anyString());
    }

    @Test
    void expiredInvitationCannotGrantMembershipButCanBeClearedAndRenewed() {
        UUID manager = registerUser("manager7");
        UUID target = registerUser("target7");
        UUID projectId = projectService.create(manager, "Expired invite project", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));
        UUID invitationId = created.invitation().getId();
        jdbc.update("UPDATE project_invitations SET expires_at = ? WHERE id = ?",
                java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(60)), invitationId);

        assertThrows(IllegalStateException.class, () -> invitationService.accept(target, projectId, invitationId,
                created.rawToken()));
        assertThrows(IllegalStateException.class, () -> invitationService.reject(target, projectId, invitationId,
                created.rawToken()));
        invitationService.cancel(manager, projectId, invitationId);
        assertEquals("EXPIRED",storedStatus(created));
        CreatedInvitation renewed=invitationService.resend(manager, projectId, invitationId);
        assertEquals("PENDING",storedStatus(renewed));
    }

    @Test
    void invitationOperationsAreScopedToTheirOwnProject() {
        UUID manager = registerUser("manager8");
        UUID target = registerUser("target8");
        UUID projectId = projectService.create(manager, "Scoped invite project A", null, null).getId();
        UUID otherProjectId = projectService.create(manager, "Scoped invite project B", null, null).getId();

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target, Set.of(ProjectRole.TESTER), null, team(projectId));
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

    @Test
    void invitationRequiresAnActiveTeamOfTheSameProject() {
        UUID manager = registerUser("teamgate");
        UUID target = registerUser("teamgatetarget");
        UUID projectId = projectService.create(manager, "Team gate project", null, null).getId();
        UUID otherProjectId = projectService.create(manager, "Team gate other", null, null).getId();
        UUID foreignTeam = team(otherProjectId);

        assertThrows(IllegalArgumentException.class, () -> invitationService.inviteRegisteredUser(manager, projectId,
                target, Set.of(ProjectRole.TESTER), null, null));
        assertThrows(NoSuchElementException.class, () -> invitationService.inviteRegisteredUser(manager, projectId,
                target, Set.of(ProjectRole.TESTER), null, foreignTeam));
        assertThrows(NoSuchElementException.class, () -> invitationService.inviteRegisteredUser(manager, projectId,
                target, Set.of(ProjectRole.TESTER), null, UUID.randomUUID()));
    }

    @Test
    void acceptingAnInvitationPutsTheNewMemberInTheInvitedTeamInTheSameTransaction() {
        UUID manager = registerUser("teamaccept");
        UUID target = registerUser("teamaccepttarget");
        UUID projectId = projectService.create(manager, "Team accept project", null, null).getId();
        UUID teamId = team(projectId);

        CreatedInvitation created = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER), null, teamId);
        assertEquals(teamId, created.invitation().getTeamId());
        invitationService.accept(target, projectId, created.invitation().getId(), created.rawToken());

        assertEquals(1L, jdbc.queryForObject("SELECT count(*) FROM squad_members sm JOIN project_memberships pm "
                + "ON pm.id = sm.project_membership_id WHERE sm.squad_id = ? AND pm.user_id = ?", Long.class,
                teamId, target));
        // The person accepted on their own, so no "you were added to a team" notification is raised.
        assertEquals(0L, jdbc.queryForObject("SELECT count(*) FROM notifications WHERE type = 'SQUAD_MEMBER_ADDED' "
                + "AND recipient_user_id = ?", Long.class, target));
    }

    @Test
    void ownerCannotBeRemovedFromTheProjectOrLoseProjectManager() {
        UUID founder = registerUser("owner");
        UUID projectId = projectService.create(founder, "Owner protected project", null, null).getId();
        UUID second = registerUser("ownersecond");
        membershipService.addMember(founder, projectId, second, Set.of(ProjectRole.PROJECT_MANAGER));

        com.pda.project.application.service.MembershipConflictException removed = assertThrows(
                com.pda.project.application.service.MembershipConflictException.class,
                () -> membershipService.removeMember(second, projectId, founder));
        assertEquals("PROJECT_OWNER_PROTECTED", removed.code());
        com.pda.project.application.service.MembershipConflictException demoted = assertThrows(
                com.pda.project.application.service.MembershipConflictException.class,
                () -> membershipService.replaceRoles(second, projectId, founder, Set.of(ProjectRole.TESTER)));
        assertEquals("PROJECT_OWNER_PROTECTED", demoted.code());
    }

    @Test
    void expiredRegisteredInviteIsNotPendingAndReinviteMaterializesExpiryBeforeUniqueInsert() {
        UUID manager=registerUser("expmanager"),target=registerUser("exptarget");
        UUID project=projectService.create(manager,"Expired registered",null,null).getId(),team=team(project);
        CreatedInvitation old=invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,team);
        age(old);
        assertEquals(0,invitationService.listPending(manager,project,PageRequest.of(0,20)).getTotalElements());
        assertEquals(0,invitationService.listProject(manager,project,InvitationStatus.PENDING,PageRequest.of(0,20)).getTotalElements());
        assertEquals(InvitationStatus.EXPIRED,invitationService.listProject(manager,project,InvitationStatus.EXPIRED,PageRequest.of(0,20)).getContent().getFirst().status());
        assertEquals(Set.of(),access.pendingInviteeIds(project,Set.of(target)));
        assertThrows(IllegalStateException.class,()->invitationService.accept(target,project,old.invitation().getId(),old.rawToken()));
        CreatedInvitation next=invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.FRONTEND_DEVELOPER),null,team);
        assertNotEquals(old.invitation().getId(),next.invitation().getId());
        assertEquals("EXPIRED",storedStatus(old));assertEquals("PENDING",storedStatus(next));
        assertEquals(1L,jdbc.queryForObject("SELECT count(*) FROM project_invitations WHERE project_id=? AND invited_user_id=? AND status='PENDING'",Long.class,project,target));
        assertEquals(InvitationConflictException.ALREADY_PENDING,assertThrows(InvitationConflictException.class,()->invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,team)).code());
    }

    @Test
    void expiredEmailReinviteRetainsCaseInsensitiveUniqueProtection() {
        UUID manager=registerUser("emailmanager"),project=projectService.create(manager,"Expired email",null,null).getId(),team=team(project);
        String email="expiry-"+UUID.randomUUID()+"@example.test";
        CreatedInvitation old=invitationService.inviteByEmail(manager,project,email,"Audit","Guest",Set.of(ProjectRole.TESTER),null,team);age(old);
        CreatedInvitation next=invitationService.inviteByEmail(manager,project,email.toUpperCase(java.util.Locale.ROOT),"Audit","Guest",Set.of(ProjectRole.TESTER),null,team);
        assertEquals("EXPIRED",storedStatus(old));assertEquals(email,next.invitation().getEmail());
        assertEquals(InvitationConflictException.ALREADY_PENDING,assertThrows(InvitationConflictException.class,()->invitationService.inviteByEmail(manager,project,email,"Audit","Guest",Set.of(ProjectRole.TESTER),null,team)).code());
    }

    @Test
    void expiredResendIssuesFreshTokenAndExpiredCancelAcknowledgesWithoutGrant() {
        UUID manager=registerUser("renewmanager"),target=registerUser("renewtarget"),other=registerUser("cleartarget");
        UUID project=projectService.create(manager,"Expired renew",null,null).getId(),team=team(project);
        CreatedInvitation old=invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,team);age(old);
        CreatedInvitation next=invitationService.resend(manager,project,old.invitation().getId());
        assertEquals("EXPIRED",storedStatus(old));assertEquals("PENDING",storedStatus(next));assertNotEquals(old.rawToken(),next.rawToken());
        assertThrows(IllegalStateException.class,()->invitationService.accept(target,project,old.invitation().getId(),old.rawToken()));
        CreatedInvitation clear=invitationService.inviteRegisteredUser(manager,project,other,Set.of(ProjectRole.TESTER),null,team);age(clear);
        invitationService.cancel(manager,project,clear.invitation().getId());invitationService.cancel(manager,project,clear.invitation().getId());
        assertEquals("EXPIRED",storedStatus(clear));assertEquals(0L,jdbc.queryForObject("SELECT count(*) FROM project_memberships WHERE project_id=? AND user_id=?",Long.class,project,other));
        invitationService.inviteRegisteredUser(manager,project,other,Set.of(ProjectRole.TESTER),null,team);
    }

    @Test
    void expiredInvitationCannotBeRenewedIntoAnArchivedTeam() {
        UUID manager=registerUser("archmanager"),target=registerUser("archtarget"),project=projectService.create(manager,"Expired archived team",null,null).getId(),first=team(project);
        CreatedInvitation old=invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,first);age(old);
        UUID backup=squadService.create(manager,project,"Backup",null,null,true).getId();squadService.archive(manager,project,first);
        assertThrows(NoSuchElementException.class,()->invitationService.resend(manager,project,old.invitation().getId()));
        invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,backup);
    }

    @Test
    void twoReinvitesWaitingOnTheExpiredRowStillCommitOnlyOnePendingInvitation() throws Exception {
        UUID manager=registerUser("racemanager"),target=registerUser("racetarget"),project=projectService.create(manager,"Expired reinvite race",null,null).getId(),team=team(project);
        CreatedInvitation old=invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,team);age(old);
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        try(var gate=dataSource.getConnection()) {
            gate.setAutoCommit(false);
            try(var statement=gate.prepareStatement("SELECT id FROM project_invitations WHERE id=? FOR UPDATE")) {
                statement.setObject(1,old.invitation().getId());statement.executeQuery().close();
            }
            java.util.concurrent.Callable<Object> create=()->{
                try{return invitationService.inviteRegisteredUser(manager,project,target,Set.of(ProjectRole.TESTER),null,team);}
                catch(InvitationConflictException|org.springframework.dao.DataIntegrityViolationException conflict){return conflict;}
            };
            var first=pool.submit(create);var second=pool.submit(create);
            try {
                long deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(10);
                int waiting=0;
                while(waiting<2&&System.nanoTime()<deadline) {
                    waiting=jdbc.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' "
                            + "AND (query LIKE '%project_invitations%' OR query LIKE '%projects%')",Integer.class);
                    if(waiting<2)Thread.sleep(20);
                }
                assertEquals(2,waiting,"Both real transactions must wait on the project-to-invitation mutation chain");
            } finally {gate.rollback();}
            Object one=first.get(10,java.util.concurrent.TimeUnit.SECONDS),two=second.get(10,java.util.concurrent.TimeUnit.SECONDS);
            assertEquals(1,(one instanceof CreatedInvitation?1:0)+(two instanceof CreatedInvitation?1:0));
            assertEquals("EXPIRED",storedStatus(old));
            assertEquals(1L,jdbc.queryForObject("SELECT count(*) FROM project_invitations WHERE project_id=? AND invited_user_id=? AND status='PENDING'",Long.class,project,target));
        } finally {pool.shutdownNow();}
    }

    private void age(CreatedInvitation invitation) {
        jdbc.update("UPDATE project_invitations SET expires_at=now()-interval '1 minute' WHERE id=?",invitation.invitation().getId());
    }
    private String storedStatus(CreatedInvitation invitation) {
        return jdbc.queryForObject("SELECT status FROM project_invitations WHERE id=?",String.class,invitation.invitation().getId());
    }

    /** The project's first active team; creates one (with the founder in it) when the project has none yet. */
    private UUID team(UUID projectId) {
        List<UUID> existing = jdbc.queryForList(
                "SELECT id FROM squads WHERE project_id = ? AND archived_at IS NULL ORDER BY created_at", UUID.class,
                projectId);
        if (!existing.isEmpty()) return existing.get(0);
        UUID founder = jdbc.queryForObject("SELECT created_by FROM projects WHERE id = ?", UUID.class, projectId);
        return squadService.create(founder, projectId, "Core", null, null, true).getId();
    }

    private UUID registerUser(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return users.registerLocal(prefix + suffix + "@example.test", prefix + "_" + suffix,
                UUID.randomUUID().toString());
    }

    private Set<String> membershipRoles(UUID projectId, UUID userId) {
        return Set.copyOf(jdbc.queryForList("SELECT role FROM project_membership_roles WHERE membership_id = "
                + "(SELECT id FROM project_memberships WHERE project_id = ? AND user_id = ?)",
                String.class, projectId, userId));
    }

    private long notificationCount(UUID invitationId, String type) {
        return jdbc.queryForObject("SELECT count(*) FROM notifications WHERE resource_id = ? AND type = ?",
                Long.class, invitationId, type);
    }
}
