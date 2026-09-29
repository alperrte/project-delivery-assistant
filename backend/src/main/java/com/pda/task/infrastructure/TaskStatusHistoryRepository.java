package com.pda.task.infrastructure;

import com.pda.task.domain.TaskStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface TaskStatusHistoryRepository extends JpaRepository<TaskStatusHistory, UUID> {
    List<TaskStatusHistory> findByTaskIdOrderByChangedAtAsc(UUID taskId);
}
