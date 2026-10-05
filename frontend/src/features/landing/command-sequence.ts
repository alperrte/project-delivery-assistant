import { REPOSITORY_URL } from "@/features/public-info/site-info";

export type CommandStep = { prompt: string; command: string; output: string[] };

/** Display-only transcript. Matches compose services and package-lock/npm scripts; never executed. */
export function commandSequence(envOutput: string): CommandStep[] {
  const home = "C:\\Users\\alper";
  const repo = home + "\\project-delivery-assistant";
  return [
    { prompt: home, command: "git clone " + REPOSITORY_URL + ".git", output: ["Cloning into 'project-delivery-assistant'...", "Receiving objects... done.", "Resolving deltas... done."] },
    { prompt: home, command: "cd project-delivery-assistant", output: [] },
    { prompt: repo, command: "copy .env.example .env", output: ["1 file(s) copied."] },
    { prompt: repo, command: "notepad .env", output: [envOutput] },
    { prompt: repo, command: "docker compose up --build -d", output: ["[+] Building backend", "✔ postgres  Healthy", "✔ backend   Started"] },
    { prompt: repo, command: "cd frontend", output: [] },
    { prompt: repo + "\\frontend", command: "npm ci", output: ["Dependencies installed from package-lock.json."] },
    { prompt: repo + "\\frontend", command: "npm run dev", output: ["> frontend@0.1.0 dev", "> next dev", "▲ Next.js", "- Local: http://localhost:3000", "✓ Ready"] },
  ];
}
