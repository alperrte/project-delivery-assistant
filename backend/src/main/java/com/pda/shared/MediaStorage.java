package com.pda.shared;
import java.io.IOException;
/** Technical private object storage port; callers own authorization and lifecycle. */
public interface MediaStorage {
    void put(String key, byte[] bytes) throws IOException;
    byte[] read(String key, int expectedSize) throws IOException;
    void delete(String key) throws IOException;
}
