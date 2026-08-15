import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { useGitHub } from "./storage.js";
import type { RandomSurveyResponse } from "./types.js";

export type WalldamPoints = {
  total: number;
  seoulGyeonggi: number;
  busanUlsanGyeongnam: number;
  daeguGyeongbuk: number;
  gwangjuJeonnam: number;
  daejeonChungcheong: number;
  gangwon: number;
  jeonbuk: number;
  jeju: number;
};

export interface WalldamPointsRecord {
  email: string;
  points: WalldamPoints;
  /** Asia/Seoul 기준 YYYY-MM-DD — 하루 1회 적립 */
  lastEarnDate: string | null;
  updatedAt: string;
}

export const EMPTY_POINTS: WalldamPoints = {
  total: 0,
  seoulGyeonggi: 0,
  busanUlsanGyeongnam: 0,
  daeguGyeongbuk: 0,
  gwangjuJeonnam: 0,
  daejeonChungcheong: 0,
  gangwon: 0,
  jeonbuk: 0,
  jeju: 0,
};

const LOCAL_DIR = path.join(process.cwd(), "server-data", "points");

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailFileId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);
}

function localPath(email: string) {
  return path.join(LOCAL_DIR, `${emailFileId(email)}.json`);
}

function githubFilePath(email: string) {
  const base = process.env.GITHUB_POINTS_PATH || "data/points";
  return `${base}/${emailFileId(email)}.json`;
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

/** 한국 날짜 YYYY-MM-DD */
export function koreaDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function emptyRecord(email: string): WalldamPointsRecord {
  return {
    email: normalizeEmail(email),
    points: { ...EMPTY_POINTS },
    lastEarnDate: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadWalldamPoints(
  email: string
): Promise<WalldamPointsRecord> {
  const normalized = normalizeEmail(email);
  if (!normalized) return emptyRecord("");

  if (!useGitHub()) {
    try {
      const raw = await readFile(localPath(normalized), "utf-8");
      return JSON.parse(raw) as WalldamPointsRecord;
    } catch {
      return emptyRecord(normalized);
    }
  }

  const data = await githubRequest("GET", githubFilePath(normalized));
  if (!data?.content) return emptyRecord(normalized);
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return JSON.parse(decoded) as WalldamPointsRecord;
}

export async function saveWalldamPoints(
  record: WalldamPointsRecord
): Promise<void> {
  const payload = JSON.stringify(record, null, 2);

  if (!useGitHub()) {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(localPath(record.email), payload, "utf-8");
    return;
  }

  const filePath = githubFilePath(record.email);
  const content = Buffer.from(payload).toString("base64");
  let sha: string | undefined;
  try {
    const existing = await githubRequest("GET", filePath);
    if (existing?.sha) sha = existing.sha;
  } catch {
    /* create */
  }

  await githubRequest("PUT", filePath, {
    message: `Update walldam points ${record.email}`,
    content,
    sha,
  });
}

/** 설문 도시명 → 지역별 적립 포인트 계산 */
export function computeEarnFromSurveyCities(
  surveys: RandomSurveyResponse[]
): WalldamPoints {
  const counts: Record<string, number> = {};
  for (const s of surveys) {
    const city = (s.rosterFields?.["도시명"] ?? "").trim();
    if (!city) continue;
    counts[city] = (counts[city] ?? 0) + 1;
  }

  const n = (name: string) => counts[name] ?? 0;

  const n1 = n("서울특별시");
  const n2 = n("부산광역시");
  const n3 = n("대구광역시");
  const n4 = n("인천광역시");
  const n5 = n("광주광역시");
  const n6 = n("대전광역시");
  const n7 = n("울산광역시");
  const n8 = n("세종특별자치시");
  const n9 = n("경기도");
  const n10 = n("강원특별자치도");
  const n11 = n("충청북도");
  const n12 = n("충청남도");
  const n13 = n("전라북도");
  const n14 = n("전라남도");
  const n15 = n("경상북도");
  const n16 = n("경상남도");
  const n17 = n("제주특별자치도");

  return {
    total: n1 + n2 + n3 + n4 + n5 + n6 + n7 + n8 + n9 + n10 + n11 + n12 + n13 + n14 + n15 + n16 + n17,
    seoulGyeonggi: n1 + n9 + n4,
    busanUlsanGyeongnam: n2 + n16 + n7,
    daeguGyeongbuk: n3 + n15,
    gwangjuJeonnam: n5 + n14,
    daejeonChungcheong: n6 + n11 + n12 + n8,
    gangwon: n10,
    jeonbuk: n13,
    jeju: n17,
  };
}

export function addPoints(a: WalldamPoints, b: WalldamPoints): WalldamPoints {
  return {
    total: a.total + b.total,
    seoulGyeonggi: a.seoulGyeonggi + b.seoulGyeonggi,
    busanUlsanGyeongnam: a.busanUlsanGyeongnam + b.busanUlsanGyeongnam,
    daeguGyeongbuk: a.daeguGyeongbuk + b.daeguGyeongbuk,
    gwangjuJeonnam: a.gwangjuJeonnam + b.gwangjuJeonnam,
    daejeonChungcheong: a.daejeonChungcheong + b.daejeonChungcheong,
    gangwon: a.gangwon + b.gangwon,
    jeonbuk: a.jeonbuk + b.jeonbuk,
    jeju: a.jeju + b.jeju,
  };
}

export async function earnWalldamPoints(options: {
  email: string;
  surveys: RandomSurveyResponse[];
}): Promise<{
  ok: boolean;
  alreadyEarnedToday?: boolean;
  earned: WalldamPoints;
  points: WalldamPoints;
  lastEarnDate: string | null;
  message: string;
}> {
  const email = normalizeEmail(options.email);
  if (!email) {
    throw new Error("구글 계정 이메일이 필요합니다.");
  }

  const today = koreaDateString();
  const record = await loadWalldamPoints(email);

  if (record.lastEarnDate === today) {
    return {
      ok: false,
      alreadyEarnedToday: true,
      earned: { ...EMPTY_POINTS },
      points: record.points,
      lastEarnDate: record.lastEarnDate,
      message: "오늘은 이미 월담 포인트를 적립했습니다. 내일 다시 시도해 주세요.",
    };
  }

  const earned = computeEarnFromSurveyCities(options.surveys);
  if (earned.total <= 0) {
    return {
      ok: false,
      earned,
      points: record.points,
      lastEarnDate: record.lastEarnDate,
      message:
        "이 채팅방에 도시명이 있는 참가자가 없어 적립할 포인트가 없습니다.",
    };
  }

  const next: WalldamPointsRecord = {
    email,
    points: addPoints(record.points, earned),
    lastEarnDate: today,
    updatedAt: new Date().toISOString(),
  };
  await saveWalldamPoints(next);

  return {
    ok: true,
    earned,
    points: next.points,
    lastEarnDate: next.lastEarnDate,
    message: `월담 종합 포인트 +${earned.total} 적립되었습니다.`,
  };
}
