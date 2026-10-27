package com.pda.migration;

import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;

/**
 * V59 drops the archive V58 made of the pre-V57 project link. Application code must
 * remain independent of that removed column; a meeting's live link is project_id.
 */
class LegacyProjectColumnUnusedTest {
    private static final List<String> NAMES=List.of("legacy_project_id","legacyProjectId","legacyProject");

    @Test void noApplicationCodeReadsTheArchivedProjectColumn() throws IOException {
        Path main=Path.of("src/main");
        assertTrue(Files.isDirectory(main),"run from the backend module");
        try(Stream<Path> files=Files.walk(main)) {
            List<String> readers=files.filter(Files::isRegularFile)
                    .filter(path -> !path.toString().replace('\\','/').contains("/db/migration/"))
                    .filter(path -> { try { String text=Files.readString(path); return NAMES.stream().anyMatch(text::contains); } catch(IOException e) { return false; } })
                    .map(Path::toString).toList();
            assertEquals(List.of(),readers,"only migrations may name the archived column");
        }
    }
}
