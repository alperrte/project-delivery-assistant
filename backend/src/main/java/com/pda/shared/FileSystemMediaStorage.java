package com.pda.shared;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.file.*;
import java.nio.channels.FileChannel;
import java.nio.ByteBuffer;
import java.util.Set;
@Component
public class FileSystemMediaStorage implements MediaStorage {
    private final Path root;
    public FileSystemMediaStorage(@Value("${pda.organization.media.storage-path}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
        if (this.root.getParent() == null) throw new IllegalArgumentException("Storage root cannot be filesystem root");
    }
    private Path file(String key, boolean temporary) throws IOException {
        if (key == null || !key.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
            throw new IOException("Invalid storage identifier");
        // Check every existing ancestor; an application-owned private directory is required.
        for (Path p = root; p != null; p = p.getParent()) if (Files.isSymbolicLink(p)) throw new IOException("Unsafe storage root");
        Files.createDirectories(root);
        Path file = root.resolve(key + (temporary ? ".tmp" : "")).normalize();
        if (!file.getParent().equals(root) || Files.isSymbolicLink(file)) throw new IOException("Unsafe storage object");
        return file;
    }
    @Override public void put(String key, byte[] bytes) throws IOException {
        if (bytes == null || bytes.length == 0 || bytes.length > 2097152) throw new IOException("Invalid object size");
        Path temporary=file(key,true), target=file(key,false);
        try (FileChannel out=FileChannel.open(temporary,Set.of(StandardOpenOption.CREATE_NEW,StandardOpenOption.WRITE,LinkOption.NOFOLLOW_LINKS))) {
            ByteBuffer buffer=ByteBuffer.wrap(bytes); while(buffer.hasRemaining()) out.write(buffer); out.force(true);
        }
        Files.move(temporary,target,StandardCopyOption.ATOMIC_MOVE);
    }
    @Override public byte[] read(String key,int expectedSize) throws IOException {
        Path target=file(key,false);
        if(expectedSize < 1 || expectedSize > 2097152) throw new IOException("Invalid object size");
        try(FileChannel in=FileChannel.open(target,Set.of(StandardOpenOption.READ,LinkOption.NOFOLLOW_LINKS))) {
            if(in.size()!=expectedSize) throw new IOException("Object size mismatch");
            ByteBuffer buffer=ByteBuffer.allocate(expectedSize);
            while(buffer.hasRemaining()) if(in.read(buffer)<0) throw new IOException("Incomplete object");
            return buffer.array();
        }
    }
    @Override public void delete(String key) throws IOException {
        Files.deleteIfExists(file(key,true)); Files.deleteIfExists(file(key,false));
    }
}
