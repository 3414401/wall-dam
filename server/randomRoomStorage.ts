import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { RandomRoomData } from "./types.js";
import { useGitHub } from "./storage.js";

const LOCAL_DIR = path.join(process.cwd(), "server-data", "random-rooms");

async function ensureDir() {
  await mkdir(LOCAL_DIR, { recursive: true });
}

function localPath(code: string) {
  return path.join(LOCAL_DIR, `${code}.json`);
}

async function githubRequest(
  method: "GET" | "PUT" | "DELETE",
  filePath: string,
  body?: { message: string; content?: string; sha?: string }
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
  if (method === "DELETE" && res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
  return res.json();
}

function githubFilePath(code: string) {
  const base = process.env.GITHUB_RANDOM_ROOMS_PATH || "data/random-rooms";
  return `${base}/${code}.json`;
}

function githubDirPath() {
  return process.env.GITHUB_RANDOM_ROOMS_PATH || "data/random-rooms";
}

export async function loadRandomRoom(code: string): Promise<RandomRoomData | null> {
  if (!useGitHub()) {
    try {
      const raw = await readFile(localPath(code), "utf-8");
      return JSON.parse(raw) as RandomRoomData;
    } catch {
      return null;
    }
  }

  const filePath = githubFilePath(code);
  const data = await githubRequest("GET", filePath);
  if (!data || !data.content) return null;

  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return JSON.parse(decoded) as RandomRoomData;
}

export async function saveRandomRoom(room: RandomRoomData): Promise<void> {
  if (!useGitHub()) {
    await ensureDir();
    await writeFile(localPath(room.code), JSON.stringify(room, null, 2), "utf-8");
    return;
  }

  const filePath = githubFilePath(room.code);
  const content = Buffer.from(JSON.stringify(room, null, 2)).toString("base64");

  let sha: string | undefined;
  try {
    const existing = await githubRequest("GET", filePath);
    if (existing?.sha) sha = existing.sha;
  } catch {
    /* new file */
  }

  await githubRequest("PUT", filePath, {
    message: `Update random room ${room.code}`,
    content,
    ...(sha ? { sha } : {}),
  });
}

const HIDDEN_ROOM_CODES = new Set(["872452", "193413", "742344"]);

export async function listRandomRoomCodes(): Promise<string[]> {
  if (!useGitHub()) {
    try {
      await ensureDir();
      const files = await readdir(LOCAL_DIR);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .filter((code) => !HIDDEN_ROOM_CODES.has(code));
    } catch {
      return [];
    }
  }

  const dirPath = githubDirPath();
  const data = await githubRequest("GET", dirPath);
  if (!data || !Array.isArray(data)) return [];

  return data
    .filter((item: { name?: string; type?: string }) => item.type === "file")
    .map((item: { name?: string }) => item.name?.replace(/\.json$/, "") ?? "")
    .filter((code) => Boolean(code) && !HIDDEN_ROOM_CODES.has(code));
}

export async function deleteRandomRoom(code: string): Promise<boolean> {
  if (!useGitHub()) {
    try {
      const { unlink } = await import("fs/promises");
      await unlink(localPath(code));
      return true;
    } catch {
      return false;
    }
  }

  const filePath = githubFilePath(code);
  const existing = await githubRequest("GET", filePath);
  if (!existing?.sha) return false;

  await githubRequest("DELETE", filePath, {
    message: `Delete random room ${code}`,
    sha: existing.sha,
  });
  return true;
}
