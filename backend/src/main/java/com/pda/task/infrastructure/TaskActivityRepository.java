package com.pda.task.infrastructure;

import com.pda.task.domain.ActivityType;
import com.pda.task.domain.TaskActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface TaskActivityRepository extends JpaRepository<TaskActivity, UUID> {
    List<TaskActivity> findByTaskId(UUID taskId);

    /** Moments a sprint's tasks were moved to DONE, used for the burndown. */
    @Query("select a.taskId, a.createdAt from TaskActivity a where a.type = :type and a.newValue = 'DONE' "
            + "and a.taskId in (select t.id from Task t where t.sprintId = :sprintId and t.archivedAt is null) "
            + "order by a.createdAt")
    List<Object[]> doneMomentsForSprint(@Param("sprintId") UUID sprintId, @Param("type") ActivityType type);
}
