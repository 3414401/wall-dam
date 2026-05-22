import { balanceTeams } from "./balance.js";
import { generateText, hasGemini, parseJsonFromText } from "./gemini.js";
import type { SessionData, SurveyResponse, TeamGroup } from "./types.js";

function teamSumsFromMembers(members: SurveyResponse[]): number[] {
  const dims = members[0]?.scores.length ?? 5;
  const sums = Array(dims).fill(0);
  for (const m of members) {
    m.scores.forEach((v, i) => {
      sums[i] += v;
    });
  }
  return sums;
}

interface AiTeamsPayload {
  teams: { teamIndex: number; memberIds: string[] }[];
  summary?: string;
}

function validateAiTeams(
  surveys: SurveyResponse[],
  teams: AiTeamsPayload["teams"],
  teamCount: number
): TeamGroup[] {
  const ids = new Set(surveys.map((s) => s.id));
  const seen = new Set<string>();
  const groups: TeamGroup[] = [];

  for (const t of teams) {
    const members: SurveyResponse[] = [];
    for (const id of t.memberIds) {
      if (!ids.has(id) || seen.has(id)) {
        throw new Error("AI가 잘못된 멤버 ID를 반환했습니다.");
      }
      seen.add(id);
      const m = surveys.find((s) => s.id === id);
      if (m) members.push(m);
    }
    if (members.length > 0) {
      groups.push({
        teamIndex: t.teamIndex,
        memberIds: members.map((m) => m.id),
        totals: teamSumsFromMembers(members),
      });
    }
  }

  if (seen.size !== surveys.length) {
    throw new Error("AI 조 배치에 누락된 멤버가 있습니다.");
  }

  return groups
    .sort((a, b) => a.teamIndex - b.teamIndex)
    .slice(0, teamCount);
}

export async function balanceTeamsWithAi(
  session: SessionData,
  teamCount: number
): Promise<{ groups: TeamGroup[]; note: string; usedAi: boolean }> {
  const count = Math.max(
    2,
    Math.min(teamCount, session.surveys.length)
  );

  if (!hasGemini()) {
    return {
      groups: balanceTeams(session.surveys, count),
      note: "GEMINI_API_KEY 없음 → 자동(균형) 알고리즘으로 배치했습니다.",
      usedAi: false,
    };
  }

  const roster = session.surveys
    .map(
      (s) =>
        `{"id":"${s.id}","nickname":"${s.nickname}","scores":[${s.scores.join(",")}]}`
    )
    .join(",\n");

  const prompt = `팀프로젝트 조 배치 전문가입니다. ${session.surveys.length}명을 ${count}개 조로 나누세요.

목표:
1) 각 조의 5개 기준 합계가 비슷하게
2) 각 기준별로 조 간 점수 분포가 고르게
3) 한 조에 너무 강하거나 약한 사람만 몰리지 않게

[기준] ${session.abilities.join(" | ")}

[멤버 JSON 배열]
[
${roster}
]

규칙:
- memberIds는 위 id를 그대로 사용
- 모든 멤버를 정확히 한 조에만 배정
- teamIndex는 1부터 ${count}

JSON만:
{
  "teams": [
    { "teamIndex": 1, "memberIds": ["uuid", "..."] }
  ],
  "summary": "배치 이유 한국어 2문장"
}`;

  try {
    const raw = await generateText(prompt);
    const parsed = parseJsonFromText<AiTeamsPayload>(raw);
    if (!parsed.teams?.length) throw new Error("teams 배열 없음");
    const groups = validateAiTeams(session.surveys, parsed.teams, count);
    return {
      groups,
      note: parsed.summary?.trim() || "AI가 조를 배치했습니다.",
      usedAi: true,
    };
  } catch (e) {
    console.error("AI balance fallback", e);
    return {
      groups: balanceTeams(session.surveys, count),
      note: `AI 실패 → 자동 균형 배치로 대체 (${e instanceof Error ? e.message : "오류"})`,
      usedAi: false,
    };
  }
}
