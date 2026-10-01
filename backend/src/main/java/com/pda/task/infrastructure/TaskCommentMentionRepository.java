package com.pda.task.infrastructure;

import com.pda.task.domain.TaskCommentMention;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface TaskCommentMentionRepository extends JpaRepository<TaskCommentMention, TaskCommentMention.Key> {
    @Query("select m from TaskCommentMention m where m.commentId in :commentIds")
    List<TaskCommentMention> findByCommentIds(@Param("commentIds") Collection<UUID> commentIds);

    @Modifying
    @Query("delete from TaskCommentMention m where m.commentId = :commentId")
    int deleteByCommentId(@Param("commentId") UUID commentId);
}
