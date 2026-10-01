package com.pda.squad.application;

import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectInvitationService;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.application.service.ProjectService;
import com.pda.squad.application.service.SquadConflictException;
import com.pda.squad.application.service.SquadMemberSummary;
import com.pda.squad.application.service.SquadService;
import com.pda.squad.application.service.TeamCandidate;
import com.pda.squad.application.service.TeamView;
import com.pda.squad.domain.entity.Squad;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest(classes = BackendApplication.class)
@Testcontainers(disabledWithoutDocker = true)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class SquadServiceTest {

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

    @Autowired SquadService squadService;
    @Autowired ProjectService projectService;
    @Autowired ProjectMembershipService membershipService;
    @Autowired ProjectInvitationService invitationService;
    @Autowired UserAccounts users;
    @Autowired JdbcTemplate jdbc;

    @Test
    void newProjectHasNoTeamAndTheFirstTeamAlwaysIncludesItsCreator() {
        UUID manager = registerUser("sqfirst");
        UUID projectId = projectService.create(manager, "Teamless project", null, null).getId();
        assertEquals(0, squadService.list(manager, projectId, PageRequest.of(0, 10)).getTotalElements());

        // includeCreator=false is ignored for the first team: nobody may stay outside every team.
        Squad first = squadService.create(manager, projectId, "Core", null, null, false);
        assertEquals(1, squadService.detail(manager, projectId, first.getId()).memberCount());
        assertEquals(manager, squadService.listMembers(manager, projectId, first.getId(), PageRequest.of(0, 10))
                .getContent().get(0).userId());

        Squad second = squadService.create(manager, projectId, "Ops", null, null, false);
        assertEquals(0, squadService.detail(manager, projectId, second.getId()).memberCount());
        Squad third = squadService.create(manager, projectId, "Platform", null, null, true);
        assertEquals(1, squadService.detail(manager, projectId, third.getId()).memberCount());
    }

    @Test
    void managerCanManageTeamWhileContributorCannot() {
        UUID manager = registerUser("sqmanager");
        UUID contributor = registerUser("sqcontributor");
        UUID projectId = projectService.create(manager, "Squad service project", null, null).getId();
        membershipService.addMember(manager, projectId, contributor, Set.of(ProjectRole.BACKEND_DEVELOPER));
        UUID anchor = squadService.create(manager, projectId, "Anchor", null, null, true).getId();

        assertThrows(AccessDeniedException.class,
                () -> squadService.create(contributor, projectId, "Backend Squad", null, null, false));

        Squad squad = squadService.create(manager, projectId, "Backend Squad", "Owns the API", null, true);
        assertEquals("Backend Squad", squad.getName());
        assertEquals(2, squadService.list(contributor, projectId, PageRequest.of(0, 10)).getTotalElements());
        assertEquals(squad.getId(), squadService.detail(contributor, projectId, squad.getId()).team().getId());

        assertThrows(AccessDeniedException.class,
                () -> squadService.update(contributor, projectId, squad.getId(), "Renamed", null));
        TeamView updated = squadService.update(manager, projectId, squad.getId(), "Renamed", null);
        assertEquals("Renamed", updated.team().getName());
        assertEquals(manager, updated.updatedBy().userId());
        assertNotNull(updated.updatedBy().nickname());

        assertThrows(AccessDeniedException.class, () -> squadService.archive(contributor, projectId, squad.getId()));
        squadService.archive(manager, projectId, squad.getId());
        assertEquals(1, squadService.list(manager, projectId, PageRequest.of(0, 10)).getTotalElements());
        assertThrows(NoSuchElementException.class, () -> squadService.detail(manager, projectId, squad.getId()));
        assertThrows(NoSuchElementException.class,
                () -> squadService.update(manager, projectId, squad.getId(), "x", null));
        assertTrue(squadService.detail(manager, projectId, anchor).team().isActive());
    }

    @Test
    void onlyActiveProjectMembersCanBeAddedAndDuplicatesAreRejected() {
        UUID manager = registerUser("sqmanager2");
        UUID member = registerUser("sqmember2");
        UUID outsider = registerUser("sqoutsider2");
        UUID projectId = projectService.create(manager, "Squad membership project", null, null).getId();
        membershipService.addMember(manager, projectId, member, Set.of(ProjectRole.TESTER));
        UUID anchor = squadService.create(manager, projectId, "Anchor", null, null, true).getId();
        UUID squadId = squadService.create(manager, projectId, "QA Squad", null, null, false).getId();

        assertThrows(NoSuchElementException.class,
                () -> squadService.addMember(manager, projectId, squadId, outsider));

        SquadMemberSummary added = squadService.addMember(manager, projectId, squadId, member);
        assertEquals(member, added.userId());
        assertEquals(manager, added.addedBy());
        assertEquals(1, squadService.listMembers(member, projectId, squadId, PageRequest.of(0, 10))
                .getTotalElements());

        SquadConflictException duplicate = assertThrows(SquadConflictException.class,
                () -> squadService.addMember(manager, projectId, squadId, member));
        assertEquals(SquadConflictException.MEMBER_EXISTS, duplicate.code());

        // The member is added to the anchor team too, so leaving QA Squad does not strand them.
        squadService.addMember(manager, projectId, anchor, member);
        squadService.removeMember(manager, projectId, squadId, member);
        assertEquals(0, squadService.listMembers(manager, projectId, squadId, PageRequest.of(0, 10))
                .getTotalElements());
        assertThrows(NoSuchElementException.class,
                () -> squadService.removeMember(manager, projectId, squadId, member));
    }

    @Test
    void aMemberCannotLeaveTheirLastTeam() {
        UUID manager = registerUser("sqlast");
        UUID member = registerUser("sqlastmember");
        UUID projectId = projectService.create(manager, "Last team project", null, null).getId();
        membershipService.addMember(manager, projectId, member, Set.of(ProjectRole.TESTER));
        UUID only = squadService.create(manager, projectId, "Only", null, null, true).getId();
        squadService.addMember(manager, projectId, only, member);

        SquadConflictException conflict = assertThrows(SquadConflictException.class,
                () -> squadService.removeMember(manager, projectId, only, member));
        assertEquals(SquadConflictException.LAST_MEMBERSHIP, conflict.code());
        assertEquals(2, squadService.detail(manager, projectId, only).memberCount());

        List<SquadMemberSummary> rows = squadService.listMembers(manager, projectId, only, PageRequest.of(0, 10))
                .getContent();
        assertTrue(rows.stream().allMatch(row -> row.otherTeams().isEmpty()));
    }

    @Test
    void archivingATeamThatWouldLeaveSomeoneWithoutATeamIsRefusedAndNamesThem() {
        UUID manager = registerUser("sqorphan");
        UUID member = registerUser("sqorphanmember");
        UUID projectId = projectService.create(manager, "Orphan project", null, null).getId();
        membershipService.addMember(manager, projectId, member, Set.of(ProjectRole.TESTER));
        UUID anchor = squadService.create(manager, projectId, "Anchor", null, null, true).getId();
        UUID extra = squadService.create(manager, projectId, "Extra", null, null, true).getId();
        squadService.addMember(manager, projectId, extra, member);

        SquadConflictException conflict = assertThrows(SquadConflictException.class,
                () -> squadService.archive(manager, projectId, extra));
        assertEquals(SquadConflictException.ARCHIVE_WOULD_ORPHAN, conflict.code());
        assertEquals(1, conflict.members().size());

        // Once the member is also in the anchor team, archiving is fine and the manager keeps the anchor team.
        squadService.addMember(manager, projectId, anchor, member);
        squadService.archive(manager, projectId, extra);
        assertThrows(NoSuchElementException.class, () -> squadService.detail(manager, projectId, extra));
    }

    @Test
    void archivingCancelsPendingInvitationsIntoThatTeamAndChildTeamsBlockArchiving() {
        UUID manager = registerUser("sqinvarch");
        UUID target = registerUser("sqinvarchtarget");
        UUID projectId = projectService.create(manager, "Archive invite project", null, null).getId();
        squadService.create(manager, projectId, "Anchor", null, null, true);
        UUID team = squadService.create(manager, projectId, "Temporary", null, null, true).getId();
        UUID child = squadService.create(manager, projectId, "Child", null, team, true).getId();

        SquadConflictException blocked = assertThrows(SquadConflictException.class,
                () -> squadService.archive(manager, projectId, team));
        assertEquals(SquadConflictException.HAS_CHILDREN, blocked.code());
        squadService.archive(manager, projectId, child);

        var invitation = invitationService.inviteRegisteredUser(manager, projectId, target,
                Set.of(ProjectRole.TESTER), null, team);
        squadService.archive(manager, projectId, team);
        assertEquals("CANCELLED", jdbc.queryForObject("SELECT status FROM project_invitations WHERE id = ?",
                String.class, invitation.invitation().getId()));
    }

    @Test
    void moveRejectsCyclesAndAllowsTopLevel() {
        UUID manager = registerUser("sqmove");
        UUID projectId = projectService.create(manager, "Move project", null, null).getId();
        UUID parent = squadService.create(manager, projectId, "Parent", null, null, true).getId();
        UUID child = squadService.create(manager, projectId, "Child", null, parent, true).getId();

        SquadConflictException cycle = assertThrows(SquadConflictException.class,
                () -> squadService.move(manager, projectId, parent, child));
        assertEquals(SquadConflictException.CIRCULAR_PARENT, cycle.code());
        assertEquals(parent, squadService.detail(manager, projectId, child).team().getParentSquadId());

        TeamView moved = squadService.move(manager, projectId, child, null);
        assertNull(moved.team().getParentSquadId());
    }

    @Test
    void teamViewCarriesCountPreviewLastJoinedAndUpdater() {
        UUID manager = registerUser("sqview");
        UUID first = registerUser("sqviewfirst");
        UUID second = registerUser("sqviewsecond");
        UUID projectId = projectService.create(manager, "View project", null, null).getId();
        membershipService.addMember(manager, projectId, first, Set.of(ProjectRole.TESTER));
        membershipService.addMember(manager, projectId, second, Set.of(ProjectRole.TESTER));
        UUID teamId = squadService.create(manager, projectId, "Core", null, null, true).getId();
        squadService.addMember(manager, projectId, teamId, first);
        squadService.addMember(manager, projectId, teamId, second);

        TeamView view = squadService.detail(manager, projectId, teamId);
        assertEquals(3, view.memberCount());
        assertEquals(3, view.memberPreview().size());
        assertEquals(second, view.lastJoined().userId());
        assertEquals(second, view.memberPreview().get(0).userId());
        assertEquals(manager, view.updatedBy().userId());
        assertNotNull(view.lastJoined().joinedAt());
        assertEquals(1, squadService.listTeams(manager, projectId, PageRequest.of(0, 10)).getTotalElements());
    }

    @Test
    void candidatesReportWhereEachPersonStands() {
        UUID manager = registerUser("sqcand");
        UUID inTeam = registerUser("sqcandteam");
        UUID inProject = registerUser("sqcandproject");
        UUID invited = registerUser("sqcandinvited");
        UUID outsider = registerUser("sqcandoutsider");
        UUID projectId = projectService.create(manager, "Candidate project", null, null).getId();
        membershipService.addMember(manager, projectId, inTeam, Set.of(ProjectRole.TESTER));
        membershipService.addMember(manager, projectId, inProject, Set.of(ProjectRole.TESTER));
        UUID teamId = squadService.create(manager, projectId, "Core", null, null, true).getId();
        squadService.addMember(manager, projectId, teamId, inTeam);
        invitationService.inviteRegisteredUser(manager, projectId, invited, Set.of(ProjectRole.TESTER), null, teamId);

        assertEquals(TeamCandidate.Status.TEAM_MEMBER, statusOf(manager, projectId, teamId, inTeam, "sqcandteam"));
        assertEquals(TeamCandidate.Status.PROJECT_MEMBER,
                statusOf(manager, projectId, teamId, inProject, "sqcandproject"));
        assertEquals(TeamCandidate.Status.INVITED, statusOf(manager, projectId, teamId, invited, "sqcandinvited"));
        assertEquals(TeamCandidate.Status.NONE, statusOf(manager, projectId, teamId, outsider, "sqcandoutsider"));
        assertTrue(squadService.candidates(manager, projectId, teamId, "s").isEmpty());
        assertThrows(AccessDeniedException.class,
                () -> squadService.candidates(inProject, projectId, teamId, "sqcand"));
    }

    @Test
    void squadFromAnotherProjectIsNotAccessibleAndContributorCannotManageMembers() {
        UUID manager = registerUser("sqmanager3");
        UUID contributor = registerUser("sqcontributor3");
        UUID target = registerUser("sqtarget3");
        UUID projectId = projectService.create(manager, "Squad project A", null, null).getId();
        UUID otherProjectId = projectService.create(manager, "Squad project B", null, null).getId();
        membershipService.addMember(manager, projectId, contributor, Set.of(ProjectRole.ANALYST));
        membershipService.addMember(manager, projectId, target, Set.of(ProjectRole.TESTER));
        UUID squadId = squadService.create(manager, projectId, "Cross project squad", null, null, true).getId();

        assertThrows(NoSuchElementException.class, () -> squadService.detail(manager, otherProjectId, squadId));
        assertThrows(AccessDeniedException.class,
                () -> squadService.addMember(contributor, projectId, squadId, target));
        assertFalse(squadService.listMembers(manager, projectId, squadId, PageRequest.of(0, 10))
                .getContent().stream().anyMatch(m -> m.userId().equals(target)));

        assertTrue(squadService.addMember(manager, projectId, squadId, target).userId().equals(target));
    }

    private TeamCandidate.Status statusOf(UUID actor, UUID projectId, UUID teamId, UUID userId, String query) {
        return squadService.candidates(actor, projectId, teamId, query).stream()
                .filter(candidate -> candidate.userId().equals(userId)).findFirst().orElseThrow().status();
    }

    private UUID registerUser(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return users.registerLocal(prefix + suffix + "@example.test", prefix + "_" + suffix,
                UUID.randomUUID().toString());
    }
}