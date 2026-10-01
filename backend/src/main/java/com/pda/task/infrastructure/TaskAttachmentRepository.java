package com.pda.task.infrastructure;

import com.pda.task.domain.TaskAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TaskAttachmentRepository extends JpaRepository<TaskAttachment, UUID> {
    List<TaskAttachment> findByTaskIdAndDeletedAtIsNullOrderByUploadedAtAsc(UUID taskId);
    Optional<TaskAttachment> findByIdAndTaskIdAndDeletedAtIsNull(UUID id, UUID taskId);
    long countByTaskIdAndDeletedAtIsNull(UUID taskId);

    @Query("select a.taskId, count(a) from TaskAttachment a where a.taskId in :taskIds and a.deletedAt is null "
            + "group by a.taskId")
    List<Object[]> countsByTaskIds(@Param("taskIds") Collection<UUID> taskIds);
}
