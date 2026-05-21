export interface SurveyResponse {
  id: string;
  nickname: string;
  scores: number[];
  submittedAt: string;
}

export interface TeamGroup {
  teamIndex: number;
  memberIds: string[];
  totals: number[];
}

export interface SessionData {
  code: string;
  abilities: string[];
  createdAt: string;
  createdBy: string;
  surveys: SurveyResponse[];
  teamCount: number;
  groups: TeamGroup[] | null;
  balancedAt: string | null;
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

export function createSession(abilities: string[], createdBy: string) {
  return request<{ code: string; session: SessionData }>("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ abilities, createdBy }),
  });
}

export function getSession(code: string) {
  return request<{ session: SessionData }>(`/api/sessions/${code}`);
}

export function submitSurvey(
  code: string,
  nickname: string,
  scores: number[]
) {
  return request<{ ok: boolean; total: number }>(
    `/api/sessions/${code}/surveys`,
    {
      method: "POST",
      body: JSON.stringify({ nickname, scores }),
    }
  );
}

export function balanceSession(code: string, teamCount: number) {
  return request<{ session: SessionData }>(`/api/sessions/${code}/balance`, {
    method: "POST",
    body: JSON.stringify({ teamCount }),
  });
}
