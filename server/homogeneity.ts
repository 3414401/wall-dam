import type {
  AbilityStat,
  SessionData,
  SessionInsights,
  SurveyResponse,
  TeamInsightLine,
} from "./types.js";
import { getAiReferenceText } from "./aiReference.js";
import { getRosterAiGuideText } from "./rosterAiGuide.js";
import { generateText, hasGemini, parseJsonFromText } from "./gemini.js";

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** 응답이 전체적으로 비슷할수록 높은 점수 (0~100) */
export function computeHomogeneityIndex(surveys: SurveyResponse[]): number {
  if (surveys.length < 2) return 50;
  const dims = surveys[0].scores.length;
  let avgStd = 0;
  for (let d = 0; d < dims; d++) {
    avgStd += stdDev(surveys.map((s) => s.scores[d]));
  }
  avgStd /= dims;
  return Math.round(Math.max(0, Math.min(100, 100 - avgStd * 22)));
}

export function computeAbilityStats(session: SessionData): AbilityStat[] {
  return session.abilities.map((name, i) => {
    const vals = session.surveys.map((s) => s.scores[i]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return {
      name,
      mean: Math.round(mean * 10) / 10,
      std: Math.round(stdDev(vals) * 10) / 10,
      min: Math.min(...vals),
      max: Math.max(...vals),
    };
  });
}

function fallbackSummary(session: SessionData, index: number): string {
  const high = computeAbilityStats(session).sort((a, b) => b.mean - a.mean)[0];
  return `동질성 지수 ${index}점. 응답자들은 「${high?.name ?? "기준"}」에서 평균 ${high?.mean ?? 0}점으로 가장 두드러집니다.`;
}

export async function buildSessionInsights(
  session: SessionData
): Promise<SessionInsights> {
  const homogeneityIndex = computeHomogeneityIndex(session.surveys);
  const abilityStats = computeAbilityStats(session);

  let overallSummary = fallbackSummary(session, homogeneityIndex);
  let teamComments: TeamInsightLine[] = [];

  if (hasGemini() && session.surveys.length >= 2) {
    const roster = session.surveys
      .map((s) => {
        const excel = s.rosterFields
          ? ` | 엑셀: ${Object.entries(s.rosterFields)
              .map(([k, v]) => `${k}=${v}`)
              .join("; ")}`
          : "";
        return `- ${s.nickname}: ${session.abilities.map((a, i) => `${a}=${s.scores[i]}`).join(", ")}${excel}`;
      })
      .join("\n");

    const teamsText =
      session.groups
        ?.map((g) => {
          const names = g.memberIds
            .map((id) => session.surveys.find((s) => s.id === id)?.nickname)
            .filter(Boolean);
          return `${g.teamIndex}조: ${names.join(", ")}`;
        })
        .join("\n") || "(아직 조 배치 전)";

    const reference = await getAiReferenceText();
    const referenceBlock = reference
      ? `\n[참고 자료]\n${reference}\n`
      : "";

    const rosterGuide = await getRosterAiGuideText();
    const rosterGuideBlock = rosterGuide
      ? `\n[명단 Excel(roster.xlsx) 활용 지침]\n${rosterGuide}\n`
      : "";

    const purpose = session.teamPurpose?.trim();
    const purposeBlock = purpose
      ? `\n[조를 짜는 목적]\n${purpose}\n`
      : "";

    const prompt = `당신은 대학 팀프로젝트 조교입니다. 아래 설문(0~10점)을 분석하세요.
${purposeBlock}${referenceBlock}${rosterGuideBlock}
[기준 이름] ${session.abilities.join(", ")}
[응답 ${session.surveys.length}명]
${roster}

[조 구성]
${teamsText}

[통계]
동질성 지수(계산값): ${homogeneityIndex}/100
${abilityStats.map((s) => `${s.name}: 평균 ${s.mean}, 표준편차 ${s.std}`).join("\n")}

JSON만 출력:
{
  "overallSummary": "전체 응답 패턴을 한국어 2문장으로",
  "teamComments": [
    { "teamIndex": 1, "comment": "1조 한 줄 코멘트" }
  ]
}

teamComments는 조 배치가 있을 때만 각 조마다 1줄, 없으면 빈 배열 []`;

    try {
      const raw = await generateText(prompt);
      const parsed = parseJsonFromText<{
        overallSummary?: string;
        teamComments?: TeamInsightLine[];
      }>(raw);
      if (parsed.overallSummary?.trim()) {
        overallSummary = parsed.overallSummary.trim();
      }
      if (Array.isArray(parsed.teamComments)) {
        teamComments = parsed.teamComments.filter(
          (t) => t.teamIndex && t.comment
        );
      }
    } catch (e) {
      console.error("Gemini insights", e);
      overallSummary += " (AI 요약은 통계만 반영됨)";
    }
  }

  return {
    homogeneityIndex,
    overallSummary,
    abilityStats,
    teamComments,
    generatedAt: new Date().toISOString(),
  };
}
