import { readFile } from "fs/promises";
import path from "path";
import { loadGithubFileBinary } from "./githubFile.js";

const GUIDE_PATH =
  process.env.GITHUB_ROSTER_AI_GUIDE_PATH || "data/roster-ai-guide.md";
const LOCAL_FILE = path.join(process.cwd(), "data", "roster-ai-guide.md");

let cachedText: string | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

async function loadGuide(): Promise<string> {
  const remote = await loadGithubFileBinary(GUIDE_PATH);
  if (remote) return remote.toString("utf-8");

  try {
    return await readFile(LOCAL_FILE, "utf-8");
  } catch {
    return "";
  }
}

/** roster.xlsx 열을 AI가 어떻게 쓸지 적어 둔 한글 지침 */
export async function getRosterAiGuideText(): Promise<string> {
  const now = Date.now();
  if (cachedText !== null && now - cachedAt < CACHE_MS) {
    return cachedText;
  }

  cachedText = (await loadGuide()).trim();
  cachedAt = now;
  return cachedText;
}

export function clearRosterAiGuideCache() {
  cachedText = null;
  cachedAt = 0;
}
