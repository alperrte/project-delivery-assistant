package com.pda.reminder.infrastructure.repository;

import com.pda.reminder.domain.entity.Reminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    /**
     * What one user may see of one project in a date range: every PROJECT reminder plus their own PERSONAL ones.
     * Filtering happens here, in the query, so another user's personal reminder never reaches the service.
     */
    @Query("""
            select r from Reminder r
            where r.projectId = :projectId
              and r.reminderDate between :from and :to
              and (r.scope = com.pda.reminder.domain.enums.ReminderScope.PROJECT or r.creatorUserId = :userId)
            order by r.reminderDate, r.reminderTime nulls last, r.createdAt
            """)
    List<Reminder> findVisible(@Param("projectId") UUID projectId, @Param("userId") UUID userId,
                               @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** The pair lookup is what keeps /projects/B/reminders/{id of a project A reminder} a 404. */
    Optional<Reminder> findByIdAndProjectId(UUID id, UUID projectId);
}
