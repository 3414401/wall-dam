import { readFile } from "fs/promises";
import path from "path";
import { getExcelReferenceText, clearExcelReferenceCache } from "./excelReference.js";

const REF_PATH = process.env.GITHUB_AI_REFERENCE_PATH || "data/ai-reference.md";
const LOCAL_FILE = path.join(process.cwd(), "data", "ai-reference.md");

let cachedText: string | null = null;
let cachedAt = 0;
const CACHE_MS = 60_000;

async function loadFromGitHub(): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REF_PATH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (res.status === 404) return "";
  if (!res.ok) return null;

  const data = (await res.json()) as { content?: string };
  if (!data.content) return "";
  return Buffer.from(data.content, "base64").toString("utf-8");
}

async function loadLocal(): Promise<string> {
  try {
    return await readFile(LOCAL_FILE, "utf-8");
  } catch {
    return "";
  }
}

/** AI 조 배치·분석에 항상 넣는 참고 문서 */
export async function getAiReferenceText(): Promise<string> {
  const now = Date.now();
  if (cachedText !== null && now - cachedAt < CACHE_MS) {
    return cachedText;
  }

  let text = "";
  const fromGit = await loadFromGitHub();
  if (fromGit !== null) {
    text = fromGit;
  } else {
    text = await loadLocal();
  }

  const excel = await getExcelReferenceText();
  const parts: string[] = [];
  if (text.trim()) parts.push(text.trim());
  if (excel.trim()) parts.push(excel.trim());

  cachedText = parts.join("\n\n");
  cachedAt = now;
  return cachedText;
}

export function clearAiReferenceCache() {
  cachedText = null;
  cachedAt = 0;
  clearExcelReferenceCache();
}
