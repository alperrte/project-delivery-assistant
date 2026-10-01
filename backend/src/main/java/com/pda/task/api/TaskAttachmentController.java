package com.pda.task.api;

import com.pda.task.application.TaskAttachmentService;
import com.pda.task.application.TaskAttachmentService.AttachmentView;
import com.pda.task.application.TaskAttachmentService.Download;
import com.pda.task.domain.TaskValidationException;
import com.pda.user.UserAccounts;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/tasks/{taskId}/attachments")
public class TaskAttachmentController {
    private final TaskAttachmentService attachments;

    public TaskAttachmentController(TaskAttachmentService attachments) { this.attachments = attachments; }

    @GetMapping
    @Operation(summary = "List attachments", description = "PROJECT_VIEW; metadata only")
    public List<AttachmentView> list(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        return attachments.list(projectId, taskId, TaskController.actor(principal));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload attachment", description = "TASK_WORK; multipart part 'file'; 10 MB, 20 per task; "
            + "png jpeg webp gif pdf txt csv md zip docx xlsx pptx, verified by content")
    public ResponseEntity<AttachmentView> upload(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal,
            @RequestParam("file") MultipartFile file) {
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new TaskValidationException("TASK_ATTACHMENT_INVALID", "File could not be read");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(attachments.upload(projectId, taskId,
                TaskController.actor(principal), file.getOriginalFilename(), bytes));
    }

    @GetMapping("/{attachmentId}/content")
    @Operation(summary = "Download attachment", description = "PROJECT_VIEW; served as a download (images inline) "
            + "with nosniff and a sandbox policy")
    public ResponseEntity<byte[]> content(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @PathVariable UUID attachmentId, @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        Download file = attachments.download(projectId, taskId, attachmentId, TaskController.actor(principal));
        ContentDisposition disposition = (file.inline() ? ContentDisposition.inline()
                : ContentDisposition.attachment()).filename(file.fileName(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .contentLength(file.bytes().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "sandbox")
                .cacheControl(CacheControl.noCache().cachePrivate())
                .body(file.bytes());
    }

    @DeleteMapping("/{attachmentId}")
    @Operation(summary = "Delete attachment", description = "Uploader or TASK_MANAGE; soft delete")
    public ResponseEntity<Void> delete(@PathVariable UUID projectId, @PathVariable UUID taskId,
            @PathVariable UUID attachmentId, @AuthenticationPrincipal UserAccounts.AuthenticatedUser principal) {
        attachments.delete(projectId, taskId, attachmentId, TaskController.actor(principal));
        return ResponseEntity.noContent().build();
    }
}
