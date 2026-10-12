package com.pda.chat.api;
import com.pda.chat.application.service.ChatAttachmentService;
import com.pda.chat.api.dto.response.ChatResponses;
import com.pda.user.UserAccounts;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;
@RestController
@RequestMapping("/api/v1/chat/conversations/{conversationId}/messages")
public class ChatAttachmentController {
 private final ChatAttachmentService attachments;
 public ChatAttachmentController(ChatAttachmentService attachments){this.attachments=attachments;}
 @PostMapping(value="/attachment",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ResponseEntity<ChatResponses.Message> send(@AuthenticationPrincipal UserAccounts.AuthenticatedUser user,
   @PathVariable UUID conversationId,@RequestParam MultipartFile file,@RequestParam(required=false) String content,
   @RequestParam(required=false) UUID replyToMessageId) {
  return ResponseEntity.status(201).header("Cache-Control","private, no-store").body(ChatResponses.Message.from(attachments.send(user.id(),null,conversationId,content,replyToMessageId,file)));
 }
 @GetMapping("/{messageId}/attachment")
 public ResponseEntity<byte[]> download(@AuthenticationPrincipal UserAccounts.AuthenticatedUser user,
   @PathVariable UUID conversationId,@PathVariable UUID messageId,@RequestParam(defaultValue="false") boolean inline) {
  var file=attachments.download(user.id(),null,conversationId,messageId);
  String disposition=inline&&file.type().startsWith("image/")?"inline":"attachment";
  return ResponseEntity.ok().contentType(MediaType.parseMediaType(file.type())).header("Cache-Control","private, no-store")
   .header("X-Content-Type-Options","nosniff").header("Content-Security-Policy","default-src 'none'; sandbox")
   .header("Content-Disposition",ContentDisposition.builder(disposition).filename(file.filename(),java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(file.bytes());
 }
}
