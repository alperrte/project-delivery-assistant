package com.pda.task.domain;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Entity
@Table(name = "task_comment_mentions")
@IdClass(TaskCommentMention.Key.class)
public class TaskCommentMention {
    @Id @Column(name = "comment_id", nullable = false, updatable = false) private UUID commentId;
    @Id @Column(name = "user_id", nullable = false, updatable = false) private UUID userId;

    protected TaskCommentMention() {}

    public TaskCommentMention(UUID commentId, UUID userId) {
        this.commentId = commentId;
        this.userId = userId;
    }

    public UUID getCommentId() { return commentId; }
    public UUID getUserId() { return userId; }

    public record Key(UUID commentId, UUID userId) implements Serializable {
        public Key { Objects.requireNonNull(commentId); Objects.requireNonNull(userId); }
    }
}
