package com.pda.task.infrastructure;

import com.pda.task.domain.TaskChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskChecklistItemRepository extends JpaRepository<TaskChecklistItem, UUID> {
    List<TaskChecklistItem> findByTaskIdOrderByPositionAscCreatedAtAsc(UUID taskId);
    Optional<TaskChecklistItem> findByIdAndTaskId(UUID id, UUID taskId);
    long countByTaskId(UUID taskId);

    @Query("select i.taskId, count(i), sum(case when i.done = true then 1 else 0 end) "
            + "from TaskChecklistItem i where i.taskId in :taskIds group by i.taskId")
    List<Object[]> countsByTaskIds(@Param("taskIds") Collection<UUID> taskIds);
}
