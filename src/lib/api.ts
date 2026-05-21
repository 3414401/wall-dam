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

/** 로컬: vite proxy. GitHub Pages: Render 등에 올린 API URL (VITE_API_URL) */
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "요청에 실패했습니다.");
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
