package com.pda.reminder.application.service;

import com.pda.reminder.domain.entity.Reminder;

/** A reminder plus the nickname of its creator ({@code null} once that person has left the project). */
public record ReminderView(Reminder reminder, String creatorNickname) {
}
