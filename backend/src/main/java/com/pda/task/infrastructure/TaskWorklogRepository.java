package com.pda.task.infrastructure;

import com.pda.task.domain.TaskWorklog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskWorklogRepository extends JpaRepository<TaskWorklog, UUID> {
    List<TaskWorklog> findByTaskIdAndDeletedAtIsNullOrderByWorkDateDescCreatedAtDesc(UUID taskId);
    Optional<TaskWorklog> findByIdAndTaskIdAndDeletedAtIsNull(UUID id, UUID taskId);

    @Query("select w.taskId, sum(w.minutes) from TaskWorklog w where w.taskId in :taskIds and w.deletedAt is null "
            + "group by w.taskId")
    List<Object[]> sumsByTaskIds(@Param("taskIds") Collection<UUID> taskIds);

    @Query("select coalesce(sum(w.minutes), 0) from TaskWorklog w where w.deletedAt is null and w.taskId in "
            + "(select t.id from Task t where t.sprintId = :sprintId and t.archivedAt is null)")
    long sumForSprint(@Param("sprintId") UUID sprintId);
}
