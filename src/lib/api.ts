export interface RosterRow {
  id: string;
  label: string;
  cells: Record<string, string>;
}

export interface RosterData {
  fileName: string;
  columns: string[];
  rows: RosterRow[];
  uploadedAt: string;
}

export interface SurveyResponse {
  id: string;
  nickname: string;
  scores: number[];
  submittedAt: string;
  rosterRowId?: string;
  rosterLabel?: string;
  rosterFields?: Record<string, string>;
}

export interface TeamGroup {
  teamIndex: number;
  memberIds: string[];
  totals: number[];
}

export interface AbilityStat {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface TeamInsightLine {
  teamIndex: number;
  comment: string;
  recommendedActivity?: string;
}

export interface SessionInsights {
  homogeneityIndex: number;
  overallSummary: string;
  abilityStats: AbilityStat[];
  teamComments: TeamInsightLine[];
  generatedAt: string;
}

export interface SessionData {
  code: string;
  insightsCode?: string;
  abilities: string[];
  teamPurpose?: string;
  createdAt: string;
  createdBy: string;
  surveys: SurveyResponse[];
  teamCount: number;
  groups: TeamGroup[] | null;
  balancedAt: string | null;
  balanceMethod?: "greedy" | "ai" | null;
  aiBalanceNote?: string | null;
  aiTeamExplanations?: TeamInsightLine[] | null;
  insights?: SessionInsights | null;
  roster?: RosterData | null;
}

export const RANDOM_SUBJECTS = [
  "기획/아이디어",
  "광고/마케팅",
  "사진/영상/UCC",
  "디자인/순수미술/공예",
  "네이밍/슬로건",
  "캐릭터/만화/게임",
  "건축/건설/인테리어",
  "과학/공학",
  "예체능/패션",
  "전시/페스티벌",
  "문학/시나리오",
  "해외",
  "학술",
  "창업",
] as const;

export const RANDOM_CRITERION1 = "선호하는 토론 난이도";

export type RandomSubject = (typeof RANDOM_SUBJECTS)[number];

export interface RandomChatMessage {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  system?: boolean;
}

export interface RandomRoomPublic {
  code: string;
  subject: RandomSubject;
  criterion3: string;
  criterion4: string;
  createdAt: string;
  createdBy: string;
  participantCount: number;
  maxParticipants: number;
  joinClosed: boolean;
  selectedEmail: string | null;
  matchedAt: string | null;
}

import { getApiBase } from "./apiConfig";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const API_BASE = getApiBase();
  if (!API_BASE) {
    throw new Error(
      "API 주소가 비어 있습니다. https://3414401.github.io/wall-dam/ 에서 Ctrl+Shift+R 로 새로고침 후 다시 시도하세요."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch {
    const hint = import.meta.env.PROD
      ? "public/config.json 에 API 주소를 넣었는지, Render 서버가 켜져 있는지 확인하세요."
      : "API 서버가 꺼져 있습니다. CMD에서 npm run dev 로 프론트+API를 같이 실행하세요.";
    throw new Error(`서버에 연결할 수 없습니다. ${hint}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error;
    if (msg) throw new Error(msg);
    if (res.status === 404) {
      throw new Error(
        `API를 찾을 수 없습니다(404). 연결 주소: ${API_BASE} — Render 재배포·config.json 확인`
      );
    }
    throw new Error(`요청 실패 (HTTP ${res.status}). Render Logs 확인`);
  }
  return data as T;
}

export function createSession(
  abilities: string[],
  createdBy: string,
  teamPurpose?: string
) {
  return request<{ code: string; insightsCode: string; session: SessionData }>(
    "/api/sessions",
    {
      method: "POST",
      body: JSON.stringify({ abilities, createdBy, teamPurpose }),
    }
  );
}

export function getSession(code: string) {
  return request<{ session: SessionData }>(`/api/sessions/${code}`);
}

export function getRosterInfo() {
  return request<{
    fileName: string;
    rowCount: number;
    columns: string[];
  }>("/api/roster/info");
}

export function searchRosterRows(code: string, q: string) {
  const limit = q.trim() ? "30" : "500";
  const params = new URLSearchParams({ q, limit });
  return request<{ results: RosterRow[]; total: number }>(
    `/api/sessions/${code}/roster/search?${params}`
  );
}

export function submitSurvey(
  code: string,
  nickname: string,
  scores: number[],
  rosterRowId?: string
) {
  return request<{ ok: boolean; total: number }>(
    `/api/sessions/${code}/surveys`,
    {
      method: "POST",
      body: JSON.stringify({ nickname, scores, rosterRowId }),
    }
  );
}

export function balanceSession(code: string, teamCount: number) {
  return request<{ session: SessionData }>(`/api/sessions/${code}/balance`, {
    method: "POST",
    body: JSON.stringify({ teamCount }),
  });
}

export function balanceSessionAi(code: string, teamCount: number) {
  return request<{
    session: SessionData;
    note: string;
    teamExplanations?: TeamInsightLine[];
    usedAi: boolean;
  }>(`/api/sessions/${code}/balance-ai`, {
    method: "POST",
    body: JSON.stringify({ teamCount }),
  });
}

export function generateInsights(insightsCode: string) {
  return request<{ insights: SessionInsights; session: SessionData }>(
    "/api/insights",
    {
      method: "POST",
      body: JSON.stringify({ insightsCode }),
    }
  );
}

export function listRandomRooms() {
  return request<{ rooms: RandomRoomPublic[] }>("/api/random-rooms");
}

export function createRandomRoom(
  subject: RandomSubject,
  criterion3: string,
  criterion4: string,
  createdBy: string
) {
  return request<{
    code: string;
    room: RandomRoomPublic;
  }>("/api/random-rooms", {
    method: "POST",
    body: JSON.stringify({
      subject,
      criterion3,
      criterion4,
      createdBy,
    }),
  });
}

export function getRandomRoom(code: string) {
  return request<{
    room: RandomRoomPublic;
    abilities: string[];
    messages?: RandomChatMessage[];
    chatAccess: boolean;
  }>(`/api/random-rooms/${code}`);
}

export function searchRandomRosterRows(code: string, q: string) {
  const limit = q.trim() ? "30" : "500";
  const params = new URLSearchParams({ q, limit });
  return request<{ results: RosterRow[]; total: number }>(
    `/api/random-rooms/${code}/roster/search?${params}`
  );
}

export function submitRandomSurvey(
  code: string,
  nickname: string,
  email: string,
  scores: number[],
  rosterRowId?: string
) {
  return request<{
    ok: boolean;
    total: number;
    joinClosed: boolean;
    matched: boolean;
  }>(`/api/random-rooms/${code}/surveys`, {
    method: "POST",
    body: JSON.stringify({ nickname, email, scores, rosterRowId }),
  });
}

export function sendRandomMessage(
  code: string,
  authorName: string,
  body: string
) {
  return request<{ ok: boolean; messages: RandomChatMessage[] }>(
    `/api/random-rooms/${code}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ authorName, body }),
    }
  );
}
