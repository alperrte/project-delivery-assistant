package com.pda.task;

import com.pda.project.ProjectTeamDirectory;
import com.pda.task.application.*;
import com.pda.task.domain.*;
import com.pda.task.infrastructure.*;
import com.pda.task.sprint.infrastructure.SprintRepository;
import com.pda.user.UserAccounts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskAssignmentViewTest {
    @Mock TaskRepository tasks;
    @Mock TaskAssignmentRepository assignments;
    @Mock TaskLabelRepository taskLabels;
    @Mock ProjectLabelRepository labels;
    @Mock TaskChecklistItemRepository checklist;
    @Mock TaskCommentRepository comments;
    @Mock TaskAttachmentRepository attachments;
    @Mock TaskWorklogRepository worklogs;
    @Mock TaskWatcherRepository watchers;
    @Mock TaskRelationRepository relations;
    @Mock SprintRepository sprints;
    @Mock ProjectTeamDirectory teams;
    @Mock UserAccounts users;
    @Mock Clock clock;
    @InjectMocks TaskViewAssembler assembler;

    @Test void nullLegacyActorIsNotGuessedFromCreatorAndDisabledActorKeepsIdentity() {
        UUID creator = UUID.randomUUID();
        UUID recipient = UUID.randomUUID();
        UUID disabledActor = UUID.randomUUID();
        Task task = Task.create(UUID.randomUUID(), 1, "QA-1",
                new TaskDraft("Legacy assignment", null, TaskPriority.MEDIUM, null, null, null, null), creator);
        TaskAssignment legacy = mock(TaskAssignment.class);
        when(legacy.getTaskId()).thenReturn(task.getId());
        when(legacy.getUserId()).thenReturn(recipient);
        when(legacy.getAssignedAt()).thenReturn(Instant.EPOCH);
        // getAssignedBy defaults to null: the historical row cannot be recreated in the current NOT NULL schema.
        TaskAssignment disabled = new TaskAssignment(task.getId(), disabledActor, disabledActor);
        when(assignments.findByTaskIds(any())).thenReturn(List.of(legacy, disabled));
        when(clock.instant()).thenReturn(Instant.now());
        when(users.findActiveByIds(any())).thenReturn(Map.of());
        TaskView view = assembler.one(task, creator);
        assertEquals(Set.of(recipient, disabledActor), view.assigneeIds());
        assertEquals(List.of(disabledActor), view.assigners().stream().map(TaskView.PersonRef::userId).toList());
        assertNull(view.assigners().getFirst().nickname());
        assertNull(view.assignmentDetails().stream().filter(a -> a.userId().equals(recipient)).findFirst().orElseThrow().assignedBy());
        assertFalse(view.assigners().stream().anyMatch(p -> p.userId().equals(creator)));
        verify(assignments, times(1)).findByTaskIds(any());
        verify(users, times(1)).findActiveByIds(any());
    }
}
