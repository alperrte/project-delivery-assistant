package com.pda.task.domain;

import jakarta.persistence.*;
import java.util.UUID;

/** The bytes of an attachment, kept apart so listing attachments never loads them. */
@Entity
@Table(name = "task_attachment_data")
public class TaskAttachmentData {
    @Id @Column(name = "attachment_id", nullable = false, updatable = false) private UUID attachmentId;
    @Column(nullable = false, updatable = false) private byte[] data;

    protected TaskAttachmentData() {}

    public TaskAttachmentData(UUID attachmentId, byte[] data) {
        this.attachmentId = attachmentId;
        this.data = data;
    }

    public UUID getAttachmentId() { return attachmentId; }
    public byte[] getData() { return data; }
}
