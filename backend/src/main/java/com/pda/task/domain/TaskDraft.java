package com.pda.task.domain;

import java.time.Instant;
import java.time.LocalDate;

/** The basic, user-editable task fields; a full replacement on update. */
public record TaskDraft(String title, String description, TaskPriority priority, LocalDate startDate,
                        Instant deadlineAt, Integer estimatePoints, Integer timeEstimateMinutes) {

    public static TaskDraft basic(String title, String description, TaskPriority priority) {
        return new TaskDraft(title, description, priority, null, null, null, null);
    }
}
