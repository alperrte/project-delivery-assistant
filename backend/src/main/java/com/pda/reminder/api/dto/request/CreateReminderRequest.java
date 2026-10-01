package com.pda.reminder.api.dto.request;

import com.pda.reminder.domain.entity.Reminder;
import com.pda.reminder.domain.enums.ReminderScope;
import com.pda.reminder.domain.enums.ReminderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * {@code scope} is optional and defaults to PERSONAL. Asking for PROJECT is checked against the caller's role in the
 * service; there is deliberately no recipient field, a reminder always belongs to the authenticated user.
 */
public record CreateReminderRequest(
        @NotBlank @Size(max = Reminder.TITLE_LIMIT) String title,
        @Size(max = Reminder.DESCRIPTION_LIMIT) String description,
        @NotNull ReminderType type,
        ReminderScope scope,
        @NotNull LocalDate date,
        LocalTime time) {
}
