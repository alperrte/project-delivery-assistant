import { randomUUID } from "node:crypto";

/** One id per Playwright run: workers inherit it, so every account a run creates lands in that run's own ledger (see qa-cleanup.ts). */
export default function globalSetup() { process.env.PDA_QA_RUN = randomUUID(); }
