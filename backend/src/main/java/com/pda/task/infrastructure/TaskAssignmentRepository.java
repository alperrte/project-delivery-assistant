package com.pda.task.infrastructure;

import com.pda.task.domain.TaskAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Collection;
import java.util.UUID;

public interface TaskAssignmentRepository extends JpaRepository<TaskAssignment, UUID> {
    List<TaskAssignment> findByTaskId(UUID taskId);
    @Query("select a from TaskAssignment a where a.taskId in :taskIds and a.taskId in "
            + "(select t.id from Task t where t.projectId = :projectId and t.archivedAt is null)")
    List<TaskAssignment> findActiveByProjectAndTaskIds(@Param("projectId") UUID projectId,
                                                        @Param("taskIds") Collection<UUID> taskIds);
    boolean existsByTaskIdAndUserId(UUID taskId, UUID userId);

    @Query("select a from TaskAssignment a where a.userId = :userId and a.taskId in "
            + "(select t.id from Task t where t.projectId = :projectId)")
    List<TaskAssignment> findByProjectAndUser(@Param("projectId") UUID projectId, @Param("userId") UUID userId);

    @Modifying
    @Query("delete from TaskAssignment a where a.userId = :userId and a.taskId in "
            + "(select t.id from Task t where t.projectId = :projectId)")
    int deleteByProjectAndUser(@Param("projectId") UUID projectId, @Param("userId") UUID userId);
}
