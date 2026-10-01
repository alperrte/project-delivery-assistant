package com.pda.task.infrastructure;

import com.pda.task.domain.TaskLabel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TaskLabelRepository extends JpaRepository<TaskLabel, TaskLabel.Key> {
    List<TaskLabel> findByTaskId(UUID taskId);

    @Query("select l from TaskLabel l where l.taskId in :taskIds")
    List<TaskLabel> findByTaskIds(@Param("taskIds") Collection<UUID> taskIds);

    @Query("select l.labelId, count(l) from TaskLabel l where l.taskId in "
            + "(select t.id from Task t where t.projectId = :projectId and t.archivedAt is null) group by l.labelId")
    List<Object[]> usageByProject(@Param("projectId") UUID projectId);

    @Modifying
    @Query("delete from TaskLabel l where l.taskId = :taskId")
    int deleteByTaskId(@Param("taskId") UUID taskId);
}
