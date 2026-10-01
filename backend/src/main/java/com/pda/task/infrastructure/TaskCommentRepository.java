package com.pda.task.infrastructure;

import com.pda.task.domain.TaskComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskCommentRepository extends JpaRepository<TaskComment, UUID> {
    Optional<TaskComment> findByIdAndTaskId(UUID id, UUID taskId);
    List<TaskComment> findByTaskId(UUID taskId);

    @Query("select c.taskId, count(c) from TaskComment c where c.taskId in :taskIds and c.deletedAt is null "
            + "group by c.taskId")
    List<Object[]> countsByTaskIds(@Param("taskIds") Collection<UUID> taskIds);
}
