import { getAiReferenceText } from "./aiReference.js";
import { getRosterAiGuideText } from "./rosterAiGuide.js";
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
  teamExplanations?: { teamIndex: number; reason: string }[];
}

function validateAiTeams(
  surveys: SurveyResponse[],
  teams: AiTeamsPayload["teams"],
  teamCount: number
): TeamGroup[] {
  return repairAiTeams(surveys, teams, teamCount);
}

function repairAiTeams(
  surveys: SurveyResponse[],
  teams: AiTeamsPayload["teams"],
  teamCount: number
): TeamGroup[] {
  const count = Math.max(2, Math.min(teamCount, surveys.length));
  const assigned = new Set<string>();
  const groups: TeamGroup[] = [];

  const sortedTeams = [...(teams ?? [])].sort(
    (a, b) => (a.teamIndex ?? 0) - (b.teamIndex ?? 0)
  );

  for (let i = 1; i <= count; i++) {
    const t =
      sortedTeams.find((x) => x.teamIndex === i) ??
      sortedTeams[i - 1] ??
      ({ teamIndex: i, memberIds: [] } as AiTeamsPayload["teams"][number]);

    const members: SurveyResponse[] = [];
    for (const id of t.memberIds ?? []) {
      if (assigned.has(id)) continue;
      const m = surveys.find((s) => s.id === id);
      if (!m) continue;
      assigned.add(id);
      members.push(m);
    }

    groups.push({
      teamIndex: i,
      memberIds: members.map((m) => m.id),
      totals: teamSumsFromMembers(members),
    });
  }

  const unassigned = surveys.filter((s) => !assigned.has(s.id));
  for (const member of unassigned) {
    const target = groups.reduce((best, g) => {
      const bestSize = best.memberIds.length;
      const gSize = g.memberIds.length;
      if (gSize < bestSize) return g;
      if (gSize > bestSize) return best;
      const bestSum = best.totals.reduce((a, b) => a + b, 0);
      const gSum = g.totals.reduce((a, b) => a + b, 0);
      return gSum < bestSum ? g : best;
    }, groups[0]);

    target.memberIds.push(member.id);
    target.totals = teamSumsFromMembers(
      target.memberIds
        .map((id) => surveys.find((s) => s.id === id))
        .filter(Boolean) as SurveyResponse[]
    );
  }

  return groups
    .filter((g) => g.memberIds.length > 0)
    .map((g, idx) => ({ ...g, teamIndex: idx + 1 }));
}

export async function balanceTeamsWithAi(
  session: SessionData,
  teamCount: number
): Promise<{
  groups: TeamGroup[];
  note: string;
  teamExplanations: { teamIndex: number; reason: string }[];
  usedAi: boolean;
}> {
  const count = Math.max(
    2,
    Math.min(teamCount, session.surveys.length)
  );

  if (!hasGemini()) {
    return {
      groups: balanceTeams(session.surveys, count),
      note: "GEMINI_API_KEY 없음 → 자동(균형) 알고리즘으로 배치했습니다.",
      teamExplanations: [],
      usedAi: false,
    };
  }

  const roster = session.surveys
    .map((s) =>
      JSON.stringify({
        id: s.id,
        nickname: s.nickname,
        scores: s.scores,
        excelRow: s.rosterFields ?? null,
      })
    )
    .join(",\n");

  const reference = await getAiReferenceText();
  const referenceBlock = reference
    ? `\n[조직자가 제공한 참고 자료 — 반드시 우선 고려]\n${reference}\n`
    : "";

  const rosterGuide = await getRosterAiGuideText();
  const rosterGuideBlock = rosterGuide
    ? `\n[명단 Excel(roster.xlsx) 활용 지침 — excelRow 열 해석·가중치]\n${rosterGuide}\n`
    : "";

  const purpose = session.teamPurpose?.trim();
  const purposeBlock = purpose
    ? `\n[조를 짜는 목적 — 최우선 반영]\n${purpose}\n`
    : "";

  const prompt = `팀프로젝트 조 배치 전문가입니다. ${session.surveys.length}명을 ${count}개 조로 나누세요.
${purposeBlock}${referenceBlock}${rosterGuideBlock}
목표:
1) 각 조의 ${session.abilities.length}개 기준 합계가 비슷하게
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
  "summary": "전체적으로 왜 이렇게 나눴는지 한국어 3~5문장 (조를 짜는 목적·엑셀 지표 반영)",
  "teamExplanations": [
    { "teamIndex": 1, "reason": "1조 멤버 구성 이유 2~3문장 (학교명·점수·엑셀 열 언급)" }
  ]
}

teamExplanations는 1조부터 ${count}조까지 각각 1개씩 작성하세요.`;

  try {
    const raw = await generateText(prompt);
    const parsed = parseJsonFromText<AiTeamsPayload>(raw);
    if (!parsed.teams?.length) throw new Error("teams 배열 없음");
    const groups = validateAiTeams(session.surveys, parsed.teams, count);
    const explanations =
      parsed.teamExplanations?.filter((t) => t.teamIndex && t.reason?.trim()) ??
      [];

    return {
      groups,
      note:
        parsed.summary?.trim() ||
        "AI가 조를 배치했습니다. (일부 멤버는 자동 보정되었을 수 있습니다.)",
      teamExplanations: explanations,
      usedAi: true,
    };
  } catch (e) {
    console.error("AI balance fallback", e);
    const short =
      e instanceof Error
        ? e.message.replace(/Gemini API \d+: /, "").slice(0, 120)
        : "오류";
    return {
      groups: balanceTeams(session.surveys, count),
      note: `AI 실패 → 자동 균형 배치로 대체 (${short})`,
      teamExplanations: [],
      usedAi: false,
    };
  }
}
