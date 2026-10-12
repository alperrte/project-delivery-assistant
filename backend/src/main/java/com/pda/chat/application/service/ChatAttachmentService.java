package com.pda.chat.application.service;
import com.pda.chat.domain.ChatException;
import com.pda.shared.MediaStorage;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;
import java.io.IOException;
@Service
public class ChatAttachmentService {
 private final ChatService chat; private final JdbcTemplate jdbc; private final MediaStorage storage; private final TransactionTemplate tx; private final ChatSendRateLimiter limits;
 public ChatAttachmentService(ChatService chat,JdbcTemplate jdbc,MediaStorage storage,PlatformTransactionManager manager,ChatSendRateLimiter limits) {
  this.chat=chat;this.jdbc=jdbc;this.storage=storage;this.limits=limits;this.tx=new TransactionTemplate(manager);tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
 }
 public ChatViews.MessageView send(UUID actor,UUID project,UUID conversation,String text,UUID reply,MultipartFile file) {
  tx.executeWithoutResult(s->chat.accessible(actor,project,conversation));
  if(!limits.tryAcquire(actor))throw ChatException.rateLimited();
  if(file==null||file.isEmpty())throw ChatException.invalid("CHAT_ATTACHMENT_EMPTY");
  if(file.getSize()>2097152)throw ChatException.invalid("CHAT_ATTACHMENT_TOO_LARGE");
  byte[] bytes;try{bytes=file.getBytes();}catch(IOException e){throw ChatException.invalid("CHAT_ATTACHMENT_INVALID");}
  String name=ChatFileValidator.filename(file.getOriginalFilename());
  String type=ChatFileValidator.inspect(bytes,name,file.getContentType());
  UUID id=UUID.randomUUID();
  tx.executeWithoutResult(s->jdbc.update("insert into chat_attachments(id,owner_id,filename,content_type,size,state) values (?,?,?,?,?,'PENDING')",id,actor,name,type,bytes.length));
  try {
   storage.put(id.toString(),bytes);
   return chat.sendAttached(actor,project,conversation,text,reply,id);
  } catch(IOException e) {throw new ChatException(ChatException.Kind.UNAVAILABLE,"CHAT_ATTACHMENT_UNAVAILABLE");}
  finally { // Active objects survive; incomplete writes remain tracked for cleanup, including process crashes.
   tx.executeWithoutResult(s->jdbc.update("update chat_attachments set state='DELETE_PENDING' where id=? and state='PENDING'",id));
  }
 }
 public record Download(String filename,String type,byte[] bytes) {}
 public Download download(UUID actor,UUID project,UUID conversation,UUID message) {
  return tx.execute(s->{
   chat.accessible(actor,project,conversation);
   var found=jdbc.query("select a.id,a.filename,a.content_type,a.size from chat_attachments a join chat_messages m on m.id=a.message_id where m.id=? and m.conversation_id=? and m.deleted_at is null and a.state='ACTIVE'",(r,n)->new Object[]{r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getInt(4)},message,conversation);
   if(found.isEmpty())throw ChatException.notFound("CHAT_NOT_FOUND");var row=found.getFirst();
   try{return new Download((String)row[1],(String)row[2],storage.read(row[0].toString(),(Integer)row[3]));}catch(IOException e){throw new ChatException(ChatException.Kind.UNAVAILABLE,"CHAT_ATTACHMENT_UNAVAILABLE");}
  });
 }
 @Scheduled(fixedDelay=60000) public void cleanup() {
  // Pending writes are never taken while an upload can still be in flight.
  jdbc.update("update chat_attachments set state='DELETE_PENDING' where (state='PENDING' and created_at<now()-interval '1 hour') or (state='ACTIVE' and message_id is null)");
  for(UUID id:jdbc.query("select id from chat_attachments where state='DELETE_PENDING' limit 100",(r,n)->r.getObject(1,UUID.class))) {
   try{storage.delete(id.toString());jdbc.update("delete from chat_attachments where id=? and state='DELETE_PENDING'",id);}catch(IOException ignored){/* Durable ledger retries on the next sweep. */}
  }
 }
}
