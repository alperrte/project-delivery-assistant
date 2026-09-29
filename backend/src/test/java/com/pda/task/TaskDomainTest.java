package com.pda.task;

import com.pda.task.domain.*;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class TaskDomainTest {
    private final UUID actor = UUID.randomUUID();

    @Test
    void validatesFieldsAndLifecycle() {
        assertThrows(IllegalArgumentException.class, () -> create(" "));
        Task task = create("  Title  ");
        assertEquals("Title", task.getTitle());
        assertEquals(TaskStatus.BACKLOG, task.getStatus());
        assertEquals(TaskPriority.MEDIUM, task.getPriority());
        assertThrows(IllegalArgumentException.class, () -> task.update("Title", null, TaskPriority.LOW,
                LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 1), actor));
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

    private Task create(String title) {
        return Task.create(UUID.randomUUID(), 1, "PDA-1", title, null, null, null, null, actor);
    }
}
