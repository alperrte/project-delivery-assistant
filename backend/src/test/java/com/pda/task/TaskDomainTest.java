package com.pda.task;

import com.pda.task.domain.*;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class TaskDomainTest {
    private final UUID actor = UUID.randomUUID();

    @Test
    void validatesFieldsAndLifecycle() {
        assertThrows(TaskValidationException.class, () -> create(" "));
        Task task = create("  Title  ");
        assertEquals("Title", task.getTitle());
        assertEquals(TaskStatus.BACKLOG, task.getStatus());
        assertEquals(TaskPriority.MEDIUM, task.getPriority());
        assertThrows(TaskConflictException.class, () -> task.changeStatus(TaskStatus.DONE, actor));
        assertTrue(task.changeStatus(TaskStatus.TODO, actor));
        assertFalse(task.changeStatus(TaskStatus.TODO, actor));
        assertTrue(task.changeStatus(TaskStatus.IN_PROGRESS, actor));
        assertTrue(task.setBlocked(true, " waiting ", actor));
        assertEquals("waiting", task.getBlockedReason());
        assertTrue(task.changeStatus(TaskStatus.IN_REVIEW, actor));
        assertTrue(task.changeStatus(TaskStatus.TESTING, actor));
        assertTrue(task.changeStatus(TaskStatus.DONE, actor));
        assertFalse(task.isBlocked());
        assertNull(task.getBlockedReason());
        assertThrows(TaskConflictException.class, () -> task.setBlocked(true, "reason", actor));
        assertTrue(task.changeStatus(TaskStatus.IN_PROGRESS, actor));
        task.archive(actor);
        assertThrows(TaskConflictException.class, () -> task.changeStatus(TaskStatus.TODO, actor));
    }

    @Test
    void simpleTasksCanStartFromBacklogAndCompleteWithoutReview() {
        Task task = create("Simple");
        task.changeCreationMode(TaskCreationMode.SIMPLE, actor);
        assertThrows(TaskConflictException.class, () -> task.changeStatus(TaskStatus.DONE, actor));
        assertTrue(task.changeStatus(TaskStatus.IN_PROGRESS, actor));
        assertTrue(task.changeStatus(TaskStatus.TODO, actor));
        assertTrue(task.changeStatus(TaskStatus.IN_PROGRESS, actor));
        assertTrue(task.changeStatus(TaskStatus.DONE, actor));
        assertFalse(task.changeStatus(TaskStatus.DONE, actor));
        assertTrue(task.changeStatus(TaskStatus.IN_PROGRESS, actor));
    }

    @Test
    void advancedTasksStillRequireReviewAndTesting() {
        Task task = create("Advanced");
        assertThrows(TaskConflictException.class, () -> task.changeStatus(TaskStatus.IN_PROGRESS, actor));
        task.changeStatus(TaskStatus.TODO, actor);
        task.changeStatus(TaskStatus.IN_PROGRESS, actor);
        assertThrows(TaskConflictException.class, () -> task.changeStatus(TaskStatus.DONE, actor));
    }

    @Test
    void rejectsInvalidDatesEstimatesAndLongText() {
        Task task = create("Title");
        Instant deadline = Instant.parse("2026-10-01T12:00:00Z");
        var early = assertThrows(TaskValidationException.class, () -> task.update(new TaskDraft("Title", null,
                TaskPriority.LOW, LocalDate.of(2026, 10, 3), deadline, null, null), actor));
        assertEquals("TASK_DATES_INVALID", early.code());
        var points = assertThrows(TaskValidationException.class, () -> task.update(new TaskDraft("Title", null,
                TaskPriority.LOW, null, null, 4, null), actor));
        assertEquals("TASK_INVALID_ESTIMATE", points.code());
        var minutes = assertThrows(TaskValidationException.class, () -> task.update(new TaskDraft("Title", null,
                TaskPriority.LOW, null, null, 5, 0), actor));
        assertEquals("TASK_INVALID_ESTIMATE", minutes.code());
        assertThrows(TaskValidationException.class, () -> task.update(new TaskDraft("Title", "x".repeat(10001),
                TaskPriority.LOW, null, null, null, null), actor));
        task.update(new TaskDraft("Title", null, TaskPriority.HIGH, LocalDate.of(2026, 10, 1), deadline, 8, 90), actor);
        assertEquals(deadline, task.getDeadlineAt());
    }

    @Test
    void poolOffersClaimsAndDoneClosesThePool() {
        Task task = create("Pooled");
        UUID team = UUID.randomUUID();
        task.openPool(team, actor);
        assertTrue(task.isPoolOpen());
        task.claimed(actor);
        assertFalse(task.isPoolOpen());
        assertTrue(task.isClaimedFromPool());
        task.returnedToPool(actor);
        assertTrue(task.isPoolOpen());
        assertFalse(task.isClaimedFromPool());
        task.assignedDirectly(actor);
        assertFalse(task.isPoolOpen());
        task.openPool(null, actor);
        for (TaskStatus next : new TaskStatus[] {TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW,
                TaskStatus.TESTING, TaskStatus.DONE}) {
            task.changeStatus(next, actor);
        }
        assertFalse(task.isPoolOpen());
        assertThrows(TaskConflictException.class, () -> task.openPool(null, actor));
    }

    @Test
    void movingTheDeadlineStartsAFreshReminderCycle() {
        Task task = create("Deadline");
        Instant first = Instant.parse("2026-10-05T12:00:00Z");
        task.update(new TaskDraft("Deadline", null, TaskPriority.MEDIUM, null, first, null, null), actor);
        assertEquals(first, task.getDeadlineAt());
        Instant moved = Instant.parse("2026-10-08T12:00:00Z");
        task.update(new TaskDraft("Deadline", null, TaskPriority.MEDIUM, null, moved, null, null), actor);
        assertEquals(moved, task.getDeadlineAt());
        assertNull(task.getDeadlineRemindedAt());
        assertNull(task.getDeadlineOverdueNotifiedAt());
    }

    private Task create(String title) {
        return Task.create(UUID.randomUUID(), 1, "PDA-1", TaskDraft.basic(title, null, null), actor);
    }
}
