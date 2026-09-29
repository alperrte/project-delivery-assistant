package com.pda.task.infrastructure;

import com.pda.task.domain.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

public interface TaskRepository extends JpaRepository<Task, UUID> {
    Optional<Task> findByIdAndProjectId(UUID id, UUID projectId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Task t where t.id = :taskId and t.projectId = :projectId")
    Optional<Task> lockScoped(@Param("projectId") UUID projectId, @Param("taskId") UUID taskId);
    Page<Task> findByProjectIdAndArchivedAtIsNull(UUID projectId, Pageable pageable);
}
