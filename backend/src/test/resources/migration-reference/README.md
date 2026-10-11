# Pre-consolidation reference

`pre-consolidation.zip` contains the exact bytes and original filenames of all 59 production migrations from commit `148d2f1`, captured before the 2026-10-11 cleanup. It is test data, excluded from the application JAR and from the default `classpath:db/migration` location.

Do not regenerate this archive from the consolidated migrations. `LegacyMigrations` extracts it into a JUnit temporary directory. The two historical administrator upgrade tests continue to exercise V66→V71 and V68→V71 against this reference. `MigrationConsolidationTest` compares the complete final schema of this reference with the current fresh-install history on PostgreSQL 17 and 18, validates both histories and verifies rejection of an attempted old-history upgrade.

Historical data transformations remain available here (V4, V32, V34, V36, V37, V40, V54 and V68). They are unnecessary on an empty database and deliberately absent from the new production history. This archive does not provide a supported deployment upgrade path: the user confirmed that every existing database is disposable.
