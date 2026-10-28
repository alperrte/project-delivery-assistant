import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * A real NVDA screen reader, driven for tests. TEST-ONLY, local, no installation: it runs the portable NVDA copy that NVDA_PORTABLE points at
 * (made from the official installer with `--create-portable-silent`, nothing is registered in the system) with its own configuration folder.
 *
 * What NVDA says is read from its own log: at the input/output log level it writes every phrase it hands to the speech synthesiser as
 * `Speaking [...]`. The synthesiser is NVDA's built-in "silence" driver, so the computer stays quiet while NVDA does exactly what it does for a user
 * (it still builds, filters and queues every utterance); the phrases are captured as text.
 *
 * No operating-system key presses are sent. The browser's own keyboard (Playwright) moves the focus and NVDA, which is attached to the real browser, speaks
 * what it hears: the whole page when it loads (NVDA's "say all on page load"), every focus change, every live-region and state announcement. What this
 * cannot drive is NVDA's own browse-mode keys (arrows, H, D...), which only the physical keyboard (or injected OS input) reaches.
 */
export const NVDA_DIR = process.env.NVDA_PORTABLE ?? "";
export type Utterance = { text: string; commands: string };

export class Nvda {
  private process?: ChildProcess;
  readonly logFile: string;
  constructor(private readonly dir: string, private readonly work: string) { this.logFile = path.join(work, "nvda.log"); }

  static available(dir = NVDA_DIR) { return !!dir && existsSync(path.join(dir, "nvda.exe")); }

  version() { return /^Version: (.+)$/m.exec(this.log())?.[1] ?? /NVDA version ([^\s]+)/.exec(this.log())?.[1] ?? "unknown"; }

  async start() {
    mkdirSync(this.work, { recursive: true });
    const config = path.join(this.work, "config"); mkdirSync(config, { recursive: true });
    // The reader is quiet and does not interrupt: silence synthesiser, no welcome dialog, no update checks, no start/exit sounds.
    writeFileSync(path.join(config, "nvda.ini"), [
      "schemaVersion = 6", "[general]", "  language = en", "  showWelcomeDialogAtStartup = False", "  playStartAndExitSounds = False", "  askToExit = False", "  loggingLevel = IO",
      "[update]", "  autoCheck = False", "  startupNotification = False", "  askedAllowUsageStats = True", "  allowUsageStats = False",
      "[speech]", "  synth = silence", "[presentation]", "  reportHelpBalloons = False",
      // NVDA’s automatic read of a page on load can run past the end of the document into whatever window comes next: off, so it only speaks about the browser.
      "[virtualBuffers]", "  autoSayAllOnPageLoad = False",
      // NVDA also reads the text under the mouse pointer: wherever the pointer happens to rest (maybe over another application) it would speak that. Off.
      "[mouse]", "  enableMouseTracking = False", "  reportMouseShapeChanges = False",
    ].join("\n"));
    writeFileSync(this.logFile, "");
    this.process = spawn(path.join(this.dir, "nvda.exe"), ["--minimal", "--disable-addons", "--no-sr-flag", `--config-path=${config}`, `--log-file=${this.logFile}`, "--log-level=12"], { detached: false, stdio: "ignore", windowsHide: true });
    for (let waited = 0; waited < 30000; waited += 250) {
      if (/NVDA initialized/.test(this.log())) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`NVDA did not report that it was ready. Log tail:\n${this.log().slice(-1500)}`);
  }

  async stop() {
    // Stop only this test's process tree; never terminate somebody else's reader.
    try { if (this.process?.pid && this.process.exitCode === null) execFileSync("taskkill", ["/PID", String(this.process.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* already stopped */ }
    this.process = undefined;
  }

  /**
   * Read-only: is the window in front a Chromium from the Playwright browser folder? NVDA speaks whatever window is in front, so anything it says
   * while another application is in front must never be kept (it is that application’s content, not ours).
   */
  static browserIsInFront(): boolean {
    try { return execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "foreground.ps1")], { encoding: "utf8", timeout: 10000 }).trim() === "yes"; } catch { return false; }
  }

  log() { try { return readFileSync(this.logFile, "utf8"); } catch { return ""; } }
  mark() { try { return statSync(this.logFile).size; } catch { return 0; } }

  /** Everything NVDA said since `mark`, one entry per utterance (a speech sequence is joined into the text a person would hear). */
  said(mark: number, end?: number): string[] {
    const text = Buffer.from(this.log()).subarray(mark, end).toString("utf8"), spoken: string[] = [];
    // The exact layout of the line is confirmed against the real log when the reader first runs; both known layouts are accepted.
    for (const match of text.matchAll(/Speaking (\[[^\r\n]*\])/g)) spoken.push(flatten(match[1]));
    return spoken.filter(Boolean);
  }
}

/** A speech sequence as the text a person would hear: only the strings count; language switches are kept as `[tr]` markers so the language NVDA used is visible. */
function flatten(sequence: string) {
  const tagged = sequence.replace(/LangChangeCommand \('([A-Za-z-]+)'\)/g, "'[$1]'").replace(/CallbackCommand\([^)]*\)/g, "");
  const parts: string[] = [];
  for (const match of tagged.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) parts.push((match[1] ?? match[2] ?? "").replace(/\\[nrt]/g, " ").replace(/\\(.)/g, "$1"));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
