import { readFile } from "fs/promises";
import path from "path";
import { loadGithubFileBinary } from "./githubFile.js";
import { parseRosterBuffer } from "./rosterParse.js";
import type { RosterData } from "./types.js";

const REMOTE_XLSX =
  process.env.GITHUB_GLOBAL_ROSTER_PATH || "data/roster.xlsx";
const REMOTE_CSV = process.env.GITHUB_GLOBAL_ROSTER_CSV || "data/roster.csv";
const LOCAL_XLSX = path.join(process.cwd(), "data", "roster.xlsx");
const LOCAL_CSV = path.join(process.cwd(), "data", "roster.csv");

let cached: RosterData | null = null;
let cachedAt = 0;
const CACHE_MS = 120_000;

async function loadBuffer(): Promise<{ buf: Buffer; fileName: string } | null> {
  const remoteXlsx = await loadGithubFileBinary(REMOTE_XLSX);
  if (remoteXlsx) return { buf: remoteXlsx, fileName: "roster.xlsx" };

  const remoteCsv = await loadGithubFileBinary(REMOTE_CSV);
  if (remoteCsv) return { buf: remoteCsv, fileName: "roster.csv" };

  try {
    return { buf: await readFile(LOCAL_XLSX), fileName: "roster.xlsx" };
  } catch {
    /* */
  }
  try {
    return { buf: await readFile(LOCAL_CSV), fileName: "roster.csv" };
  } catch {
    return null;
  }
}

/** 영구 명단 (GitHub data/roster.xlsx 또는 .csv) */
export async function getGlobalRoster(): Promise<RosterData | null> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;

  const loaded = await loadBuffer();
  if (!loaded) {
    cached = null;
    cachedAt = now;
    return null;
  }

  try {
    cached = parseRosterBuffer(loaded.buf, loaded.fileName);
    cachedAt = now;
    return cached;
  } catch (e) {
    console.error("Global roster parse error", e);
    return null;
  }
}

export function clearGlobalRosterCache() {
  cached = null;
  cachedAt = 0;
}
