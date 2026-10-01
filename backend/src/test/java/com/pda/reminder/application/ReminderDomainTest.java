package com.pda.reminder.application;

import com.pda.reminder.domain.entity.Reminder;
import com.pda.reminder.domain.enums.ReminderScope;
import com.pda.reminder.domain.enums.ReminderType;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ReminderDomainTest {

    private static final LocalDate DATE = LocalDate.of(2026, 10, 3);

    private final UUID projectId = UUID.randomUUID();
    private final UUID creatorId = UUID.randomUUID();

    private Reminder personal(String title, String description, LocalTime time) {
        return Reminder.create(projectId, creatorId, ReminderScope.PERSONAL, ReminderType.MEETING, title,
                description, DATE, time);
    }

    @Test
    void createTrimsTextAndKeepsOwnerProjectAndDate() {
        Reminder reminder = personal("  Sprint Toplantısı  ", "  Sprint 4 sonuçları  ", LocalTime.of(14, 0));

        assertEquals("Sprint Toplantısı", reminder.getTitle());
        assertEquals("Sprint 4 sonuçları", reminder.getDescription());
        assertEquals(projectId, reminder.getProjectId());
        assertEquals(creatorId, reminder.getCreatorUserId());
        assertEquals(ReminderScope.PERSONAL, reminder.getScope());
        assertEquals(ReminderType.MEETING, reminder.getType());
        assertEquals(DATE, reminder.getReminderDate());
        assertEquals(LocalTime.of(14, 0), reminder.getReminderTime());
    }

    @Test
    void timeIsOptionalSoADateOnlyReminderIsSupported() {
        Reminder reminder = personal("Demo", null, null);

        assertEquals(DATE, reminder.getReminderDate());
        assertNull(reminder.getReminderTime());
    }

    @Test
    void whitespaceOnlyDescriptionIsNormalizedToNothing() {
        assertNull(personal("Demo", "   ", null).getDescription());
        assertNull(personal("Demo", "", null).getDescription());
        assertNull(personal("Demo", null, null).getDescription());
    }

    @Test
    void titleIsRequiredAndLengthLimited() {
        assertThrows(IllegalArgumentException.class, () -> personal(null, null, null));
        assertThrows(IllegalArgumentException.class, () -> personal("", null, null));
        assertThrows(IllegalArgumentException.class, () -> personal("   ", null, null));
        assertThrows(IllegalArgumentException.class, () -> personal("x".repeat(Reminder.TITLE_LIMIT + 1), null, null));
        assertEquals(Reminder.TITLE_LIMIT, personal("x".repeat(Reminder.TITLE_LIMIT), null, null).getTitle().length());
    }

    @Test
    void descriptionIsLengthLimited() {
        assertThrows(IllegalArgumentException.class,
                () -> personal("Demo", "x".repeat(Reminder.DESCRIPTION_LIMIT + 1), null));
    }

    @Test
    void projectCreatorScopeTypeAndDateAreRequired() {
        assertThrows(NullPointerException.class, () -> Reminder.create(null, creatorId, ReminderScope.PERSONAL,
                ReminderType.WORK, "Demo", null, DATE, null));
        assertThrows(NullPointerException.class, () -> Reminder.create(projectId, null, ReminderScope.PERSONAL,
                ReminderType.WORK, "Demo", null, DATE, null));
        assertThrows(NullPointerException.class, () -> Reminder.create(projectId, creatorId, null,
                ReminderType.WORK, "Demo", null, DATE, null));
        assertThrows(NullPointerException.class, () -> Reminder.create(projectId, creatorId, ReminderScope.PERSONAL,
                null, "Demo", null, DATE, null));
        assertThrows(NullPointerException.class, () -> Reminder.create(projectId, creatorId, ReminderScope.PERSONAL,
                ReminderType.WORK, "Demo", null, null, null));
    }

    @Test
    void editReplacesTheEditableFieldsButNeverTheScopeOrOwner() {
        Reminder reminder = Reminder.create(projectId, creatorId, ReminderScope.PROJECT, ReminderType.MEETING,
                "Demo", "old", DATE, LocalTime.of(9, 30));

        reminder.edit(ReminderType.DEADLINE, "  Teslim  ", null, DATE.plusDays(2), null);

        assertEquals("Teslim", reminder.getTitle());
        assertNull(reminder.getDescription());
        assertEquals(ReminderType.DEADLINE, reminder.getType());
        assertEquals(DATE.plusDays(2), reminder.getReminderDate());
        assertNull(reminder.getReminderTime());
        assertEquals(ReminderScope.PROJECT, reminder.getScope());
        assertEquals(creatorId, reminder.getCreatorUserId());
        assertEquals(projectId, reminder.getProjectId());
    }

    @Test
    void rejectedEditLeavesTheReminderUnchanged() {
        Reminder reminder = personal("Demo", "keep", LocalTime.NOON);

        assertThrows(IllegalArgumentException.class,
                () -> reminder.edit(ReminderType.OTHER, "  ", "new", DATE.plusDays(1), null));

        assertEquals("Demo", reminder.getTitle());
        assertEquals("keep", reminder.getDescription());
        assertEquals(ReminderType.MEETING, reminder.getType());
        assertEquals(DATE, reminder.getReminderDate());
        assertEquals(LocalTime.NOON, reminder.getReminderTime());
    }
}
