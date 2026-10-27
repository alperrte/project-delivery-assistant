import { cleanupQaAccounts } from "./qa-cleanup";

/** Runs after the last test, passed or failed. A cleanup problem is reported but never turns a green run red. */
export default function globalTeardown() {
  try {
    const removed = cleanupQaAccounts();
    if (removed) console.log(`QA cleanup: removed ${removed} throw-away account(s) with their meetings and projects`);
  } catch (error) {
    console.warn("QA cleanup skipped:", error instanceof Error ? error.message.split("\n")[0] : error);
  }
}
