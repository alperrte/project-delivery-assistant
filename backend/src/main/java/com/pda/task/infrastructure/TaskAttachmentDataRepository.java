package com.pda.task.infrastructure;

import com.pda.task.domain.TaskAttachmentData;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface TaskAttachmentDataRepository extends JpaRepository<TaskAttachmentData, UUID> {}
