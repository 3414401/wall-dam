import { readFile } from "fs/promises";
import path from "path";
import { loadGithubFileBinary } from "./githubFile.js";
import { parseRosterBuffer } from "./rosterParse.js";
import type { RosterData } from "./types.js";

/** 우선순위: schools.xlsx → schools.csv → roster.xlsx → roster.csv */
const CANDIDATES: { remote: string; local: string; fileName: string }[] = [
  {
    remote: process.env.GITHUB_SCHOOLS_PATH || "data/schools.xlsx",
    local: path.join(process.cwd(), "data", "schools.xlsx"),
    fileName: "schools.xlsx",
  },
  {
    remote: process.env.GITHUB_SCHOOLS_CSV || "data/schools.csv",
    local: path.join(process.cwd(), "data", "schools.csv"),
    fileName: "schools.csv",
  },
  {
    remote: process.env.GITHUB_GLOBAL_ROSTER_PATH || "data/roster.xlsx",
    local: path.join(process.cwd(), "data", "roster.xlsx"),
    fileName: "roster.xlsx",
  },
  {
    remote: process.env.GITHUB_GLOBAL_ROSTER_CSV || "data/roster.csv",
    local: path.join(process.cwd(), "data", "roster.csv"),
    fileName: "roster.csv",
  },
];

let cached: RosterData | null = null;
let cachedAt = 0;
const CACHE_MS = 120_000;

async function loadBuffer(): Promise<{ buf: Buffer; fileName: string } | null> {
  for (const c of CANDIDATES) {
    const remote = await loadGithubFileBinary(c.remote);
    if (remote) return { buf: remote, fileName: c.fileName };
    try {
      return { buf: await readFile(c.local), fileName: c.fileName };
    } catch {
      /* try next */
    }
  }
  return null;
}

/** 영구 명단/학교 데이터 (schools.xlsx 우선) */
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

export function listCities(roster: RosterData): string[] {
  const set = new Set<string>();
  for (const row of roster.rows) {
    const city = (row.cells["도시명"] ?? "").trim();
    if (city) set.add(city);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

export function listDistricts(roster: RosterData, city: string): string[] {
  const c = city.trim();
  const set = new Set<string>();
  for (const row of roster.rows) {
    if ((row.cells["도시명"] ?? "").trim() !== c) continue;
    const d = (row.cells["시군구"] ?? "").trim();
    if (d) set.add(d);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ko"));
}

export function listSchools(
  roster: RosterData,
  city: string,
  district: string
) {
  const c = city.trim();
  const d = district.trim();
  return roster.rows
    .filter(
      (row) =>
        (row.cells["도시명"] ?? "").trim() === c &&
        (row.cells["시군구"] ?? "").trim() === d
    )
    .map((row) => ({
      id: row.id,
      school: (row.cells["학교명"] ?? row.label).trim(),
      label: row.label,
      cells: row.cells,
    }))
    .sort((a, b) => a.school.localeCompare(b.school, "ko"));
}
