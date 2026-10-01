package com.pda.reminder.application.service;

import com.pda.project.ProjectAccess;
import com.pda.project.ProjectMemberView;
import com.pda.reminder.domain.entity.Reminder;
import com.pda.reminder.domain.enums.ReminderScope;
import com.pda.reminder.domain.enums.ReminderType;
import com.pda.reminder.infrastructure.repository.ReminderRepository;
import com.pda.user.ProjectPermission;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Calendar reminders of one project. ProjectMembership stays the authority for who may enter the project; what a
 * member may do with a reminder comes from its scope: PERSONAL belongs to its creator alone, PROJECT is shared and
 * managed through {@link ProjectPermission#REMINDER_MANAGE}. The caller id always comes from the authenticated
 * principal, never from the request body.
 *
 * <p>Membership lifecycle: reminders are deliberately <em>not</em> deleted when a member leaves the project. Every
 * operation starts with an active-membership check, so a removed member simply loses access to the project's reminders,
 * their own PERSONAL ones included, while the rows stay. PROJECT reminders are the project's, not the creator's, and
 * keep working for everyone else (the creator then shows without a nickname). If the same user is added back, their
 * membership is reactivated and their earlier PERSONAL reminders are visible to them again.
 */
@Service
public class ReminderService {

    /** A calendar shows a month at a time; a wider range would turn a calendar read into a table scan. */
    static final long MAX_RANGE_DAYS = 92;

    private final ProjectAccess projects;
    private final ReminderRepository reminders;
    private final Clock clock;

    public ReminderService(ProjectAccess projects, ReminderRepository reminders, Clock clock) {
        this.projects = projects;
        this.reminders = reminders;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ReminderView> list(UUID actor, UUID projectId, LocalDate from, LocalDate to) {
        requireMember(actor, projectId);
        if (from == null || to == null || to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("Invalid date range");
        }
        return views(projectId, reminders.findVisible(projectId, actor, from, to));
    }

    @Transactional(readOnly = true)
    public ReminderView detail(UUID actor, UUID projectId, UUID reminderId) {
        return view(visibleReminder(actor, projectId, reminderId));
    }

    @Transactional
    public ReminderView create(UUID actor, UUID projectId, ReminderScope requestedScope, ReminderType type,
                               String title, String description, LocalDate date, LocalTime time) {
        requireMember(actor, projectId);
        ReminderScope scope = requestedScope == null ? ReminderScope.PERSONAL : requestedScope;
        if (scope == ReminderScope.PROJECT) {
            requireProjectReminderManager(actor, projectId);
        }
        requireNotPast(date);
        return view(reminders.save(Reminder.create(projectId, actor, scope, type, title, description, date, time)));
    }

    /** Replaces the editable fields. The scope is not editable: nobody can turn a reminder into a project-wide one. */
    @Transactional
    public ReminderView update(UUID actor, UUID projectId, UUID reminderId, ReminderType type, String title,
                               String description, LocalDate date, LocalTime time) {
        Reminder reminder = visibleReminder(actor, projectId, reminderId);
        requireCanModify(actor, projectId, reminder);
        if (date != null && !date.equals(reminder.getReminderDate())) {
            // Editing the title of an old reminder stays possible; moving it into the past does not.
            requireNotPast(date);
        }
        reminder.edit(type, title, description, date, time);
        return view(reminders.save(reminder));
    }

    @Transactional
    public void delete(UUID actor, UUID projectId, UUID reminderId) {
        Reminder reminder = visibleReminder(actor, projectId, reminderId);
        requireCanModify(actor, projectId, reminder);
        reminders.delete(reminder);
    }

    /**
     * Looks the reminder up by project AND id, so another project's reminder id is a 404 here, and answers 404 (not
     * 403) for someone else's personal reminder so its existence is not revealed.
     */
    private Reminder visibleReminder(UUID actor, UUID projectId, UUID reminderId) {
        requireMember(actor, projectId);
        Reminder reminder = reminders.findByIdAndProjectId(reminderId, projectId)
                .orElseThrow(() -> new NoSuchElementException("Reminder not found"));
        if (reminder.getScope() == ReminderScope.PERSONAL && !reminder.getCreatorUserId().equals(actor)) {
            throw new NoSuchElementException("Reminder not found");
        }
        return reminder;
    }

    private void requireCanModify(UUID actor, UUID projectId, Reminder reminder) {
        if (reminder.getScope() == ReminderScope.PROJECT) {
            requireProjectReminderManager(actor, projectId);
        }
    }

    private void requireProjectReminderManager(UUID actor, UUID projectId) {
        if (!projects.hasPermission(projectId, actor, ProjectPermission.REMINDER_MANAGE)) {
            throw new AccessDeniedException("Project reminder management denied");
        }
    }

    private void requireMember(UUID actor, UUID projectId) {
        if (actor == null || projectId == null || !projects.isMember(projectId, actor)) {
            throw new AccessDeniedException("Project access denied");
        }
    }

    private void requireNotPast(LocalDate date) {
        if (date == null) {
            throw new IllegalArgumentException("date is required");
        }
        // The server clock is UTC while the user picked the day in their own timezone, so one day of slack keeps a
        // valid "today" from being rejected around midnight.
        if (date.isBefore(LocalDate.now(clock).minusDays(1))) {
            throw new IllegalArgumentException("Reminder date is in the past");
        }
    }

    private ReminderView view(Reminder reminder) {
        return views(reminder.getProjectId(), List.of(reminder)).get(0);
    }

    private List<ReminderView> views(UUID projectId, List<Reminder> found) {
        Map<UUID, String> nicknames = new HashMap<>();
        for (Reminder reminder : found) {
            nicknames.computeIfAbsent(reminder.getCreatorUserId(), creator -> {
                ProjectMemberView member = projects.member(projectId, creator);
                return member == null ? null : member.nickname();
            });
        }
        return found.stream()
                .map(reminder -> new ReminderView(reminder, nicknames.get(reminder.getCreatorUserId())))
                .toList();
    }
}
