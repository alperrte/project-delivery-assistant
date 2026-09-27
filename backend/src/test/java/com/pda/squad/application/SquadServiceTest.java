package com.pda.squad.application;

import com.pda.BackendApplication;
import com.pda.project.application.service.ProjectMembershipService;
import com.pda.project.application.service.ProjectService;
import com.pda.squad.application.service.SquadConflictException;
import com.pda.squad.application.service.SquadMemberSummary;
import com.pda.squad.application.service.SquadService;
import com.pda.squad.domain.entity.Squad;
import com.pda.user.ProjectRole;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
    @Autowired UserAccounts users;

    @Test
    void managerCanManageSquadWhileContributorCannot() {
        UUID manager = registerUser("sqmanager");
        UUID contributor = registerUser("sqcontributor");
        UUID projectId = projectService.create(manager, "Squad service project", null, null).getId();
        membershipService.addMember(manager, projectId, contributor, Set.of(ProjectRole.BACKEND_DEVELOPER));

        assertThrows(AccessDeniedException.class,
                () -> squadService.create(contributor, projectId, "Backend Squad", null));

        Squad squad = squadService.create(manager, projectId, "Backend Squad", "Owns the API");
        assertEquals("Backend Squad", squad.getName());
        assertEquals(1, squadService.list(contributor, projectId, PageRequest.of(0, 10)).getTotalElements());
        assertEquals(squad.getId(), squadService.detail(contributor, projectId, squad.getId()).getId());

        assertThrows(AccessDeniedException.class,
                () -> squadService.update(contributor, projectId, squad.getId(), "Renamed", null));
        Squad updated = squadService.update(manager, projectId, squad.getId(), "Renamed", null);
        assertEquals("Renamed", updated.getName());

        assertThrows(AccessDeniedException.class, () -> squadService.archive(contributor, projectId, squad.getId()));
        squadService.archive(manager, projectId, squad.getId());
        assertEquals(0, squadService.list(manager, projectId, PageRequest.of(0, 10)).getTotalElements());
        assertThrows(NoSuchElementException.class, () -> squadService.detail(manager, projectId, squad.getId()));
        // The active-squad lookup already filters out archived rows, matching ProjectService's own pattern:
        // Squad.requireActive()'s IllegalStateException only fires against an in-memory reference, never here.
        assertThrows(NoSuchElementException.class,
                () -> squadService.update(manager, projectId, squad.getId(), "x", null));
    }

    @Test
    void onlyActiveProjectMembersCanBeAddedAndDuplicatesAreRejected() {
        UUID manager = registerUser("sqmanager2");
        UUID member = registerUser("sqmember2");
        UUID outsider = registerUser("sqoutsider2");
        UUID projectId = projectService.create(manager, "Squad membership project", null, null).getId();
        membershipService.addMember(manager, projectId, member, Set.of(ProjectRole.TESTER));
        UUID squadId = squadService.create(manager, projectId, "QA Squad", null).getId();

        assertThrows(NoSuchElementException.class,
                () -> squadService.addMember(manager, projectId, squadId, outsider));

        SquadMemberSummary added = squadService.addMember(manager, projectId, squadId, member);
        assertEquals(member, added.userId());
        assertEquals(manager, added.addedBy());
        assertEquals(1, squadService.listMembers(member, projectId, squadId, PageRequest.of(0, 10))
                .getTotalElements());

        assertThrows(SquadConflictException.class,
                () -> squadService.addMember(manager, projectId, squadId, member));

        squadService.removeMember(manager, projectId, squadId, member);
        assertEquals(0, squadService.listMembers(manager, projectId, squadId, PageRequest.of(0, 10))
                .getTotalElements());
        assertThrows(NoSuchElementException.class,
                () -> squadService.removeMember(manager, projectId, squadId, member));
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
        UUID squadId = squadService.create(manager, projectId, "Cross project squad", null).getId();

        assertThrows(NoSuchElementException.class, () -> squadService.detail(manager, otherProjectId, squadId));
        assertThrows(AccessDeniedException.class,
                () -> squadService.addMember(contributor, projectId, squadId, target));
        assertFalse(squadService.listMembers(manager, projectId, squadId, PageRequest.of(0, 10))
                .getContent().stream().anyMatch(m -> m.userId().equals(target)));

        assertTrue(squadService.addMember(manager, projectId, squadId, target).userId().equals(target));
    }

    private UUID registerUser(String prefix) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return users.registerLocal(prefix + suffix + "@example.test", prefix + "_" + suffix,
                UUID.randomUUID().toString());
    }
}
