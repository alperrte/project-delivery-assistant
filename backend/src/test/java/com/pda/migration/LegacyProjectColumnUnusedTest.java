package com.pda.migration;

import org.junit.jupiter.api.Test;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;

/**
 * meetings.legacy_project_id is the archive V58 made of the project a meeting belonged to before V57. It is deliberately kept (dropping it would
 * be irreversible and V58 has not run in production yet), but only on the condition that nothing ever reads it: a meeting's project is
 * meetings.project_id, and an old value there must never turn into a live project link. This guard keeps "archive only" true until a later
 * migration drops the column.
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
