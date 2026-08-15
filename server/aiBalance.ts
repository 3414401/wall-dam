import { getAiReferenceText } from "./aiReference.js";
import { getRosterAiGuideText } from "./rosterAiGuide.js";
import { balanceTeams } from "./balance.js";
import { generateText, hasGemini, parseJsonFromText } from "./gemini.js";
import {
  fallbackRecommendedActivity,
  formatSchoolActivityLine,
  pickSchoolActivityMetrics,
  SCHOOL_ACTIVITY_PROMPT_RULES,
} from "./schoolActivityMetrics.js";
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
  teams: {
    teamIndex: number;
    memberIds: string[];
    recommendedActivity?: string;
  }[];
  summary?: string;
  teamExplanations?: {
    teamIndex: number;
    reason: string;
    recommendedActivity?: string;
  }[];
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

function activitiesFromPayload(
  surveys: SurveyResponse[],
  groups: TeamGroup[],
  parsed: AiTeamsPayload,
  purpose?: string
): { teamIndex: number; reason: string; recommendedActivity: string }[] {
  const reasonMap = new Map(
    (parsed.teamExplanations ?? []).map((t) => [
      t.teamIndex,
      {
        reason: t.reason?.trim() || "",
        activity: t.recommendedActivity?.trim() || "",
      },
    ])
  );
  const teamActivityMap = new Map(
    (parsed.teams ?? []).map((t) => [
      t.teamIndex,
      t.recommendedActivity?.trim() || "",
    ])
  );

  return groups.map((g) => {
    const members = g.memberIds
      .map((id) => surveys.find((s) => s.id === id))
      .filter(Boolean) as SurveyResponse[];
    const fromExpl = reasonMap.get(g.teamIndex);
    const activity =
      fromExpl?.activity ||
      teamActivityMap.get(g.teamIndex) ||
      fallbackRecommendedActivity(members, purpose);

    return {
      teamIndex: g.teamIndex,
      reason: fromExpl?.reason || `${g.teamIndex}조 배치`,
      recommendedActivity: activity,
    };
  });
}

export async function balanceTeamsWithAi(
  session: SessionData,
  teamCount: number
): Promise<{
  groups: TeamGroup[];
  note: string;
  teamExplanations: {
    teamIndex: number;
    reason: string;
    recommendedActivity: string;
  }[];
  usedAi: boolean;
}> {
  const count = Math.max(
    2,
    Math.min(teamCount, session.surveys.length)
  );

  if (!hasGemini()) {
    const groups = balanceTeams(session.surveys, count);
    return {
      groups,
      note: "자동 균형 배치",
      teamExplanations: groups.map((g) => {
        const members = g.memberIds
          .map((id) => session.surveys.find((s) => s.id === id))
          .filter(Boolean) as SurveyResponse[];
        return {
          teamIndex: g.teamIndex,
          reason: "",
          recommendedActivity: fallbackRecommendedActivity(
            members,
            session.teamPurpose
          ),
        };
      }),
      usedAi: false,
    };
  }

  const roster = session.surveys
    .map((s) => {
      const schoolActivity = pickSchoolActivityMetrics(s.rosterFields);
      return JSON.stringify({
        id: s.id,
        nickname: s.nickname,
        scores: s.scores,
        schoolActivity,
        schoolActivitySummary: formatSchoolActivityLine(schoolActivity),
        excelRow: s.rosterFields ?? null,
      });
    })
    .join(",\n");

  const reference = await getAiReferenceText();
  const referenceBlock = reference
    ? `\n[참고]\n${reference.slice(0, 1500)}\n`
    : "";

  const rosterGuide = await getRosterAiGuideText();
  const rosterGuideBlock = rosterGuide
    ? `\n[명단 지침]\n${rosterGuide.slice(0, 1800)}\n`
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
4) 학교 공공데이터(schoolActivity)로 다양성을 높이되, 배치 후 조별 추천활동도 작성

[기준] ${session.abilities.join(" | ")}

[멤버 JSON 배열]
[
${roster}
]

${SCHOOL_ACTIVITY_PROMPT_RULES}

규칙:
- memberIds는 위 id를 그대로 사용
- 모든 멤버를 정확히 한 조에만 배정
- teamIndex는 1부터 ${count}

JSON만:
{
  "teams": [
    {
      "teamIndex": 1,
      "memberIds": ["uuid", "..."],
      "recommendedActivity": "이 조의 학교 지표(사회 문화 획일성·소비 1~3위 업종)를 반영한 추천활동 1문장"
    }
  ],
  "summary": "전체적으로 왜 이렇게 나눴는지 한국어 3~5문장 (조를 짜는 목적·학교 지표 반영)",
  "teamExplanations": [
    {
      "teamIndex": 1,
      "reason": "1조 멤버 구성 이유 2~3문장 (학교명·점수·사회 문화 획일성·소비 업종 언급)",
      "recommendedActivity": "1조 추천활동 (학교 지표 반영, teams와 동일해도 됨)"
    }
  ]
}

teamExplanations는 1조부터 ${count}조까지 각각 1개씩 작성하세요.`;

  try {
    const raw = await generateText(prompt, { maxOutputTokens: 4096 });
    const parsed = parseJsonFromText<AiTeamsPayload>(raw);
    if (!parsed.teams?.length) throw new Error("teams 배열 없음");
    const groups = validateAiTeams(session.surveys, parsed.teams, count);
    const explanations = activitiesFromPayload(
      session.surveys,
      groups,
      parsed,
      session.teamPurpose
    );

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
    const groups = balanceTeams(session.surveys, count);
    return {
      groups,
      note: "자동 균형 배치",
      teamExplanations: groups.map((g) => {
        const members = g.memberIds
          .map((id) => session.surveys.find((s) => s.id === id))
          .filter(Boolean) as SurveyResponse[];
        return {
          teamIndex: g.teamIndex,
          reason: "",
          recommendedActivity: fallbackRecommendedActivity(
            members,
            session.teamPurpose
          ),
        };
      }),
      usedAi: false,
    };
  }
}
