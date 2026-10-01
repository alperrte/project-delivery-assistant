package com.pda.reminder.api.dto.request;

import com.pda.reminder.domain.entity.Reminder;
import com.pda.reminder.domain.enums.ReminderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Replaces every editable field: an omitted {@code description} or {@code time} clears it. The scope is not part of
 * this request on purpose; a reminder keeps the scope it was created with.
 */
public record UpdateReminderRequest(
        @NotBlank @Size(max = Reminder.TITLE_LIMIT) String title,
        @Size(max = Reminder.DESCRIPTION_LIMIT) String description,
        @NotNull ReminderType type,
        @NotNull LocalDate date,
        LocalTime time) {
}
