package com.pda.squad.application;

import com.pda.BackendApplication;
import com.pda.project.application.service.*;
import com.pda.squad.SquadLifecycleEvents.TeamDeleted;
import com.pda.squad.application.service.*;
import com.pda.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.event.TransactionalEventListener;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;

import javax.sql.DataSource;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(classes = BackendApplication.class)
@Testcontainers
@Import(TeamDeletionConcurrencyTest.Config.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class TeamDeletionConcurrencyTest {
    @Container static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");
    static final byte[] JWT_KEY = new byte[32];
    static { new SecureRandom().nextBytes(JWT_KEY); }
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
        r.add("FRONTEND_URL", () -> "http://localhost:3000");
        r.add("JWT_SECRET", () -> Base64.getEncoder().encodeToString(JWT_KEY));
    }
    @Autowired SquadService squads;
    @Autowired ProjectService projects;
    @Autowired ProjectMembershipService members;
    @Autowired ProjectInvitationService invitations;
    @Autowired UserAccounts users;
    @Autowired JdbcTemplate db;
    @Autowired DataSource dataSource;
    @Autowired TransactionTemplate transaction;
    @Autowired Recorder recorder;
    @Autowired com.pda.task.application.TaskService tasks;
    @Autowired com.pda.task.application.TaskPoolService poolTasks;

    @Test void softDeleteRetainsSimpleAndAdvancedPoolTasksAndExistingArchivedTargetBehavior() {
        Fixture f = fixture();
        projects.changeTaskManagementMode(f.actor, f.project, com.pda.project.TaskManagementMode.BOTH);
        List<UUID> taskIds = new ArrayList<>();
        for (var mode : com.pda.task.domain.TaskCreationMode.values()) {
            var command = new com.pda.task.application.TaskCommand(
                    com.pda.task.domain.TaskDraft.basic("Retained " + mode, null, com.pda.task.domain.TaskPriority.MEDIUM),
                    null, null, null, null, new com.pda.task.application.TaskCommand.PoolRequest(true, f.team), mode, null);
            UUID id = tasks.create(f.project, f.actor, command).id();
            taskIds.add(id);
            assertThrows(com.pda.task.domain.TaskForbiddenException.class,
                    () -> poolTasks.claim(f.project, id, f.viewer));
        }
        squads.deleteTeam(f.actor, f.project, f.team);
        for (UUID id : taskIds) {
            assertEquals(f.team, db.queryForObject("SELECT pool_team_id FROM tasks WHERE id=?", UUID.class, id));
            poolTasks.claim(f.project, id, f.viewer);
            assertEquals(f.viewer, db.queryForObject("SELECT user_id FROM task_assignments WHERE task_id=?", UUID.class, id));
            poolTasks.release(f.project, id, f.viewer);
            assertTrue(db.queryForObject("SELECT pool_open FROM tasks WHERE id=?", Boolean.class, id));
            assertEquals(f.team, db.queryForObject("SELECT pool_team_id FROM tasks WHERE id=?", UUID.class, id));
        }
        assertEquals(2L, db.queryForObject("SELECT count(*) FROM tasks WHERE project_id=?", Long.class, f.project));
    }

    @Test void snapshotRetainsHistoryExcludesActorAndProjectOnlyViewerAndRollbackEmitsNothing() {
        Fixture f = fixture();
        UUID pendingUser = user(), elapsedUser = user();
        var pending = invitations.inviteRegisteredUser(f.actor, f.project, pendingUser, Set.of(ProjectRole.TESTER), null, f.team);
        var elapsed = invitations.inviteRegisteredUser(f.actor, f.project, elapsedUser, Set.of(ProjectRole.TESTER), null, f.team);
        db.update("UPDATE project_invitations SET expires_at=now()-interval '1 minute' WHERE id=?", elapsed.invitation().getId());
        assertThrows(IllegalStateException.class, () -> transaction.execute(status -> {
            squads.deleteTeam(f.actor, f.project, f.team);
            throw new IllegalStateException("TEST-ONLY rollback");
        }));
        assertTrue(recorder.forTeam(f.team).isEmpty());
        assertNull(db.queryForObject("SELECT archived_at FROM squads WHERE id=?", java.sql.Timestamp.class, f.team));
        assertEquals("PENDING", storedStatus(pending));
        squads.deleteTeam(f.actor, f.project, f.team);
        assertEquals(1, recorder.forTeam(f.team).size());
        TeamDeleted event = recorder.forTeam(f.team).getFirst();
        assertEquals(Set.of(f.a, f.b), event.recipientIds());
        assertEquals(f.actor, event.deletedBy());
        assertEquals("Delete target", event.teamName());
        assertNotNull(event.projectName());
        assertNotNull(event.actorNickname());
        assertThrows(UnsupportedOperationException.class, () -> event.recipientIds().add(f.viewer));
        assertEquals(3L, db.queryForObject("SELECT count(*) FROM squad_members WHERE squad_id=?", Long.class, f.team));
        assertNotNull(db.queryForObject("SELECT archived_at FROM squads WHERE id=?", java.sql.Timestamp.class, f.team));
        assertNull(db.queryForObject("SELECT archived_at FROM squads WHERE id=?", java.sql.Timestamp.class, f.backup));
        assertEquals("CANCELLED", storedStatus(pending));
        assertEquals("EXPIRED", storedStatus(elapsed));
        assertThrows(NoSuchElementException.class, () -> squads.detail(f.actor, f.project, f.team));
        assertThrows(NoSuchElementException.class, () -> squads.deleteTeam(f.actor, f.project, f.team));
        assertEquals(1, recorder.forTeam(f.team).size());
    }

    @Test void twoDeletesWaitingOnTheRealProjectLockProduceOnlyOneSuccessfulDeletion() throws Exception {
        Fixture f = fixture();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try (var gate = dataSource.getConnection()) {
            gate.setAutoCommit(false);
            try (var statement = gate.prepareStatement("SELECT id FROM projects WHERE id=? FOR UPDATE")) {
                statement.setObject(1, f.project); statement.executeQuery().close();
            }
            Callable<Object> delete = () -> result(() -> squads.deleteTeam(f.actor, f.project, f.team));
            var first = pool.submit(delete); var second = pool.submit(delete);
            try { waitForLocks(2); } finally { gate.rollback(); }
            Object a = first.get(15, TimeUnit.SECONDS), b = second.get(15, TimeUnit.SECONDS);
            assertEquals(1, (Boolean.TRUE.equals(a) ? 1 : 0) + (Boolean.TRUE.equals(b) ? 1 : 0));
            assertEquals(1, (a instanceof NoSuchElementException ? 1 : 0) + (b instanceof NoSuchElementException ? 1 : 0));
            assertEquals(1, recorder.forTeam(f.team).size());
        } finally { pool.shutdownNow(); }
    }

    @Test void deleteCommitBeforeWaitingAcceptCancelsTheInviteWithoutMembershipGrant() throws Exception {
        Fixture f = fixture(); UUID recipient = user();
        var invite = invitations.inviteRegisteredUser(f.actor, f.project, recipient, Set.of(ProjectRole.TESTER), null, f.team);
        Object outcome = committedFirst(() -> squads.deleteTeam(f.actor, f.project, f.team),
                () -> invitations.acceptMine(recipient, invite.invitation().getId()));
        assertInstanceOf(InvitationConflictException.class, outcome);
        assertEquals("CANCELLED", storedStatus(invite));
        assertEquals(0L, db.queryForObject("SELECT count(*) FROM project_memberships WHERE project_id=? AND user_id=?",
                Long.class, f.project, recipient));
        assertEquals(1, recorder.forTeam(f.team).size());
    }

    @Test void committedChildCreationPreventsWaitingParentDelete() throws Exception {
        Fixture f = fixture();
        Object outcome = committedFirst(() -> squads.create(f.actor, f.project, "Child", null, f.team, false),
                () -> squads.deleteTeam(f.actor, f.project, f.team));
        assertEquals(SquadConflictException.HAS_CHILDREN, assertInstanceOf(SquadConflictException.class, outcome).code());
        assertTrue(recorder.forTeam(f.team).isEmpty());
        assertNull(db.queryForObject("SELECT archived_at FROM squads WHERE id=?", java.sql.Timestamp.class, f.team));
    }

    @Test void committedMemberAddIsIncludedInTheWaitingDeletionSnapshot() throws Exception {
        Fixture f = fixture();
        Object outcome = committedFirst(() -> squads.addMember(f.actor, f.project, f.team, f.viewer),
                () -> squads.deleteTeam(f.actor, f.project, f.team));
        assertEquals(Boolean.TRUE, outcome);
        assertEquals(Set.of(f.a, f.b, f.viewer), recorder.forTeam(f.team).getFirst().recipientIds());
    }

    @Test void committedProjectRenameIsCapturedByTheWaitingDeletion() throws Exception {
        Fixture f = fixture();
        Object outcome = committedFirst(() -> db.update("UPDATE projects SET name=? WHERE id=?", "Committed new name", f.project),
                () -> squads.deleteTeam(f.actor, f.project, f.team));
        assertEquals(Boolean.TRUE, outcome);
        assertEquals("Committed new name", recorder.forTeam(f.team).getFirst().projectName());
    }

    @Test void committedProjectMemberRemovalIsExcludedFromTheWaitingDeletionSnapshot() throws Exception {
        Fixture f = fixture();
        Object outcome = committedFirst(() -> members.removeMember(f.actor, f.project, f.a),
                () -> squads.deleteTeam(f.actor, f.project, f.team));
        assertEquals(Boolean.TRUE, outcome);
        assertEquals(Set.of(f.b), recorder.forTeam(f.team).getFirst().recipientIds());
    }

    @Test void committedChildMovePreventsTheWaitingParentDeletion() throws Exception {
        Fixture f = fixture();
        UUID child = squads.create(f.actor, f.project, "Movable child", null, null, false).getId();
        Object outcome = committedFirst(() -> squads.move(f.actor, f.project, child, f.team),
                () -> squads.deleteTeam(f.actor, f.project, f.team));
        assertEquals(SquadConflictException.HAS_CHILDREN, assertInstanceOf(SquadConflictException.class, outcome).code());
        assertTrue(recorder.forTeam(f.team).isEmpty());
    }

    @Test void committedManagerDemotionRejectsTheWaitingDeletion() throws Exception {
        Fixture f = fixture(); UUID manager = user();
        members.addMember(f.actor, f.project, manager, Set.of(ProjectRole.PROJECT_MANAGER));
        squads.addMember(f.actor, f.project, f.backup, manager);
        Object outcome = committedFirst(() -> members.replaceRoles(f.actor, f.project, manager, Set.of(ProjectRole.TESTER)),
                () -> squads.deleteTeam(manager, f.project, f.team));
        assertInstanceOf(org.springframework.security.access.AccessDeniedException.class, outcome);
        assertTrue(recorder.forTeam(f.team).isEmpty());
    }

    @Test void cachedExternalPreviewCannotOverrideACommittedTeamDeletion() throws Exception {
        Fixture f = fixture(); String suffix = UUID.randomUUID().toString().substring(0, 8);
        String email = "preview" + suffix + "@example.test";
        var invite = invitations.inviteByEmail(f.actor, f.project, email, "First", "Last", Set.of(ProjectRole.TESTER), null, f.team);
        UUID recipient = users.registerInvitedLocal(email, "preview_" + suffix, UUID.randomUUID().toString(), "First", "Last");
        ExecutorService pool = Executors.newSingleThreadExecutor();
        CountDownLatch previewed = new CountDownLatch(1), deleted = new CountDownLatch(1);
        try {
            var accepting = pool.submit(() -> transaction.execute(status -> {
                invitations.preview(invite.rawToken());
                previewed.countDown();
                await(deleted);
                return result(() -> invitations.acceptExistingAccount(invite.rawToken(), recipient));
            }));
            assertTrue(previewed.await(10, TimeUnit.SECONDS));
            try { squads.deleteTeam(f.actor, f.project, f.team); } finally { deleted.countDown(); }
            // A rejected operation can mark its outer transaction rollback-only; either wrapper preserves no grant.
            try { assertInstanceOf(NoSuchElementException.class, accepting.get(15, TimeUnit.SECONDS)); }
            catch (ExecutionException e) {
                assertInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class, e.getCause());
            }
            assertEquals(0L, db.queryForObject("SELECT count(*) FROM project_memberships WHERE project_id=? AND user_id=?",
                    Long.class, f.project, recipient));
            assertEquals("CANCELLED", storedStatus(invite));
        } finally { deleted.countDown(); pool.shutdownNow(); }
    }

    private Object committedFirst(Runnable first, Runnable second) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch mutated = new CountDownLatch(1), release = new CountDownLatch(1);
        try {
            var writer = pool.submit(() -> transaction.execute(status -> { first.run(); mutated.countDown(); await(release); return true; }));
            assertTrue(mutated.await(10, TimeUnit.SECONDS));
            var waiter = pool.submit(() -> result(second));
            try { waitForLocks(1); } finally { release.countDown(); }
            assertTrue(writer.get(15, TimeUnit.SECONDS));
            return waiter.get(15, TimeUnit.SECONDS);
        } finally { release.countDown(); pool.shutdownNow(); }
    }
    private void waitForLocks(int expected) throws InterruptedException {
        long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        int count = 0;
        while (count < expected && System.nanoTime() < until) {
            count = db.queryForObject("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() "
                    + "AND wait_event_type='Lock' AND query LIKE '%projects%'", Integer.class);
            if (count < expected) Thread.sleep(20);
        }
        assertEquals(expected, count, "Real mutations must reach the project lock before the gate is released");
    }
    private static Object result(Runnable action) {
        try { action.run(); return Boolean.TRUE; } catch (RuntimeException e) { return e; }
    }
    private static void await(CountDownLatch latch) {
        try { if (!latch.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("Barrier timeout"); }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); }
    }
    private String storedStatus(ProjectInvitationService.CreatedInvitation i) {
        return db.queryForObject("SELECT status FROM project_invitations WHERE id=?", String.class, i.invitation().getId());
    }
    private Fixture fixture() {
        UUID actor = user(), a = user(), b = user(), viewer = user();
        UUID project = projects.create(actor, "Deletion " + UUID.randomUUID().toString().substring(0, 8), null, null).getId();
        UUID backup = squads.create(actor, project, "Backup", null, null, true).getId();
        UUID team = squads.create(actor, project, "Delete target", null, null, true).getId();
        for (UUID member : Set.of(a, b, viewer)) {
            members.addMember(actor, project, member, Set.of(ProjectRole.TESTER));
            squads.addMember(actor, project, backup, member);
        }
        squads.addMember(actor, project, team, a); squads.addMember(actor, project, team, b);
        return new Fixture(actor, a, b, viewer, project, backup, team);
    }
    private UUID user() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        return users.registerLocal("deletion" + suffix + "@example.test", "d" + suffix, UUID.randomUUID().toString());
    }
    record Fixture(UUID actor, UUID a, UUID b, UUID viewer, UUID project, UUID backup, UUID team) {}
    static class Recorder {
        final List<TeamDeleted> events = new CopyOnWriteArrayList<>();
        @TransactionalEventListener public void deleted(TeamDeleted event) { events.add(event); }
        List<TeamDeleted> forTeam(UUID team) { return events.stream().filter(e -> e.teamId().equals(team)).toList(); }
    }
    @TestConfiguration static class Config {
        @Bean Recorder recorder() { return new Recorder(); }
    }
}
