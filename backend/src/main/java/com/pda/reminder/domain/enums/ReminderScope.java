package com.pda.reminder.domain.enums;

/** Who can see a reminder. Fixed at creation; a reminder never changes scope. */
public enum ReminderScope {
    /** Visible to its creator only. Any active project member may create one. */
    PERSONAL,
    /** Visible to every active project member. Only a user holding REMINDER_MANAGE (the Project Manager) may create one. */
    PROJECT
}
