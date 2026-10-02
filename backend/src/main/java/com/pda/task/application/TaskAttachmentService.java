package com.pda.task.application;

import com.pda.task.domain.*;
import com.pda.task.infrastructure.TaskAttachmentDataRepository;
import com.pda.task.infrastructure.TaskAttachmentRepository;
import com.pda.user.ProjectPermission;
import com.pda.user.UserAccounts;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.*;

/** File attachments of a task. Bytes live in their own table and are only read by the download call. */
@Service
public class TaskAttachmentService {
    private final TaskSupport support;
    private final TaskAttachmentRepository attachments;
    private final TaskAttachmentDataRepository data;
    private final UserAccounts users;

    public TaskAttachmentService(TaskSupport support, TaskAttachmentRepository attachments,
                                 TaskAttachmentDataRepository data, UserAccounts users) {
        this.support = support; this.attachments = attachments; this.data = data; this.users = users;
    }

    public record AttachmentView(UUID id, String fileName, String contentType, long sizeBytes, UUID uploadedBy,
                                 String uploadedByName, Instant uploadedAt) {}

    public record Download(String fileName, String contentType, boolean inline, byte[] bytes) {}

    @Transactional(readOnly = true)
    public List<AttachmentView> list(UUID projectId, UUID taskId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        return views(attachments.findByTaskIdAndDeletedAtIsNullOrderByUploadedAtAsc(taskId));
    }

    @Transactional
    public AttachmentView upload(UUID projectId, UUID taskId, UUID actor, String originalName, byte[] bytes) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.TASK_WORK);
        Task task = support.locked(projectId, taskId);
        if (bytes == null || bytes.length == 0) {
            throw new TaskValidationException("TASK_ATTACHMENT_INVALID", "Empty file");
        }
        if (bytes.length > TaskAttachment.MAX_BYTES) {
            throw new TaskValidationException("TASK_ATTACHMENT_TOO_LARGE", "File is too large");
        }
        AttachmentPolicy.Accepted accepted = AttachmentPolicy.check(originalName, bytes);
        if (attachments.countByTaskIdAndDeletedAtIsNull(taskId) >= TaskAttachment.MAX_PER_TASK) {
            throw new TaskConflictException("TASK_ATTACHMENT_LIMIT", "Attachment limit reached");
        }
        TaskAttachment attachment = attachments.save(new TaskAttachment(taskId, projectId, accepted.fileName(),
                accepted.contentType(), bytes.length, sha256(bytes), actor));
        data.save(new TaskAttachmentData(attachment.getId(), bytes));
        support.record(taskId, projectId, actor, ActivityType.ATTACHMENT_ADDED, "attachment", null,
                accepted.fileName());
        task.touchedBy(actor);
        return views(List.of(attachment)).get(0);
    }

    @Transactional(readOnly = true)
    public Download download(UUID projectId, UUID taskId, UUID attachmentId, UUID actor) {
        support.requireProject(projectId, actor, false);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        support.visible(projectId, taskId);
        TaskAttachment attachment = find(taskId, attachmentId);
        byte[] bytes = data.findById(attachmentId).map(TaskAttachmentData::getData)
                .orElseThrow(() -> new NoSuchElementException("Attachment not found"));
        boolean inline = attachment.getContentType().matches("image/(png|jpeg|webp|gif)");
        return new Download(attachment.getFileName(), attachment.getContentType(), inline, bytes);
    }

    @Transactional
    public void delete(UUID projectId, UUID taskId, UUID attachmentId, UUID actor) {
        support.requireProject(projectId, actor, true);
        support.requirePermission(projectId, actor, ProjectPermission.PROJECT_VIEW);
        Task task = support.mutable(projectId, taskId);
        TaskAttachment attachment = find(taskId, attachmentId);
        if (!attachment.getUploadedBy().equals(actor)
                && !support.can(projectId, actor, ProjectPermission.TASK_MANAGE)) {
            throw new AccessDeniedException("Attachment permission denied");
        }
        attachment.delete(actor);
        // The row stays as history, but the stored bytes go with it: nothing reads them again and they would
        // otherwise pile up for good.
        data.deleteById(attachmentId);
        support.record(taskId, projectId, actor, ActivityType.ATTACHMENT_REMOVED, "attachment",
                attachment.getFileName(), null);
        task.touchedBy(actor);
    }

    private TaskAttachment find(UUID taskId, UUID attachmentId) {
        return attachments.findByIdAndTaskIdAndDeletedAtIsNull(attachmentId, taskId)
                .orElseThrow(() -> new NoSuchElementException("Attachment not found"));
    }

    private List<AttachmentView> views(List<TaskAttachment> list) {
        if (list.isEmpty()) return List.of();
        Set<UUID> uploaderIds = new HashSet<>();
        list.forEach(a -> uploaderIds.add(a.getUploadedBy()));
        Map<UUID, UserAccounts.AuthenticatedUser> names = users.findActiveByIds(uploaderIds);
        return list.stream().map(a -> new AttachmentView(a.getId(), a.getFileName(), a.getContentType(),
                a.getSizeBytes(), a.getUploadedBy(),
                names.get(a.getUploadedBy()) == null ? null : names.get(a.getUploadedBy()).nickname(),
                a.getUploadedAt())).toList();
    }

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
