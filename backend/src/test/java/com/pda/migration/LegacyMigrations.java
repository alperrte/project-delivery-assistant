package com.pda.migration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipInputStream;

/** Immutable, test-only pre-consolidation history from commit 148d2f1. Never a production Flyway location. */
public final class LegacyMigrations {
    private LegacyMigrations() {}

    public static String extractTo(Path directory) throws IOException {
        try (var resource = LegacyMigrations.class.getResourceAsStream("/migration-reference/pre-consolidation.zip")) {
            if (resource == null) {
                throw new IOException("Missing pre-consolidation migration reference");
            }
            try (var zip = new ZipInputStream(resource)) {
                int count = 0;
                for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                    if (entry.isDirectory() || !entry.getName().matches("V[0-9]+__[a-z0-9_]+\\.sql")) {
                        throw new IOException("Unexpected reference archive entry");
                    }
                    Files.copy(zip, directory.resolve(entry.getName()));
                    count++;
                }
                if (count != 59) {
                    throw new IOException("Incomplete pre-consolidation migration reference");
                }
            }
        }
        return "filesystem:" + directory.toAbsolutePath();
    }
}
