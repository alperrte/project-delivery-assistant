package com.pda.shared;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.io.IOException;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
class FileSystemMediaStorageTest {
 @TempDir Path directory;
 @Test void storedObjectsSurviveNewAdapterAndDeleteIsIdempotent() throws Exception {
  String key=UUID.randomUUID().toString();byte[] data={1,2,3};
  var storage=new FileSystemMediaStorage(directory.toString());storage.put(key,data);
  assertArrayEquals(data,new FileSystemMediaStorage(directory.toString()).read(key,3));
  assertThrows(IOException.class,()->storage.read(key,4));
  storage.delete(key);storage.delete(key);assertFalse(Files.exists(directory.resolve(key)));
 }
 @Test void clientPathsAndOversizeWritesAreRejected() {
  var storage=new FileSystemMediaStorage(directory.toString());
  for(String key:new String[]{"../escape","C:/escape","name.png","../../secret"})
   assertThrows(IOException.class,()->storage.put(key,new byte[]{1}));
  assertThrows(IOException.class,()->storage.put(UUID.randomUUID().toString(),new byte[2097153]));
 }
 @Test void pendingTemporaryFileIsCleanedAfterCrash() throws Exception {
  String key=UUID.randomUUID().toString();Files.write(directory.resolve(key+".tmp"),new byte[]{1});
  new FileSystemMediaStorage(directory.toString()).delete(key);
  assertFalse(Files.exists(directory.resolve(key+".tmp")));
 }
}
