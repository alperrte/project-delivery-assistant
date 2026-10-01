package com.pda.reminder.api.dto.response;

import com.pda.reminder.application.service.ReminderView;
import com.pda.reminder.domain.entity.Reminder;
import com.pda.reminder.domain.enums.ReminderScope;
import com.pda.reminder.domain.enums.ReminderType;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** Calendar view of a reminder. The type is a plain enum name: icons and labels belong to the client. */
public record ReminderResponse(UUID id, String title, String description, ReminderType type, ReminderScope scope,
                               LocalDate date, LocalTime time, Creator creator) {

    /** Minimum creator summary; {@code nickname} is null once the creator has left the project. */
    public record Creator(UUID userId, String nickname) {
    }

    public static ReminderResponse from(ReminderView view) {
        Reminder reminder = view.reminder();
        return new ReminderResponse(reminder.getId(), reminder.getTitle(), reminder.getDescription(),
                reminder.getType(), reminder.getScope(), reminder.getReminderDate(), reminder.getReminderTime(),
                new Creator(reminder.getCreatorUserId(), view.creatorNickname()));
    }
}
