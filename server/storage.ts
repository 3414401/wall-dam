import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SessionData } from "./types.js";

const DATA_DIR = path.join(process.cwd(), "server-data");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function localPath(code: string) {
  return path.join(DATA_DIR, `${code}.json`);
}

export async function loadSessionLocal(code: string): Promise<SessionData | null> {
  try {
    const raw = await readFile(localPath(code), "utf-8");
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function saveSessionLocal(session: SessionData): Promise<void> {
  await ensureDir();
  await writeFile(localPath(session.code), JSON.stringify(session, null, 2), "utf-8");
}

async function githubRequest(
  method: "GET" | "PUT",
  filePath: string,
  body?: { message: string; content: string; sha?: string }
) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) return null;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (method === "GET" && res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

export function useGitHub(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN &&
      process.env.GITHUB_OWNER &&
      process.env.GITHUB_REPO
  );
}

function githubFilePath(code: string) {
  const base = process.env.GITHUB_DATA_PATH || "data/sessions";
  return `${base}/${code}.json`;
}

export async function loadSession(code: string): Promise<SessionData | null> {
  if (!useGitHub()) return loadSessionLocal(code);

  const filePath = githubFilePath(code);
  const data = await githubRequest("GET", filePath);
  if (!data || !data.content) return null;

  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return JSON.parse(decoded) as SessionData;
}

export async function saveSession(session: SessionData): Promise<void> {
  if (!useGitHub()) {
    await saveSessionLocal(session);
    return;
  }

  const filePath = githubFilePath(session.code);
  const content = Buffer.from(JSON.stringify(session, null, 2)).toString("base64");

  let sha: string | undefined;
  try {
    const existing = await githubRequest("GET", filePath);
    if (existing?.sha) sha = existing.sha;
  } catch {
    /* new file */
  }

  await githubRequest("PUT", filePath, {
    message: `Update session ${session.code}`,
    content,
    ...(sha ? { sha } : {}),
  });
}
