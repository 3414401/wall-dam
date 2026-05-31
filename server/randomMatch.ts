import { generateText, hasGemini, parseJsonFromText } from "./gemini.js";
import type { RandomRoomData, RandomSurveyResponse } from "./types.js";

function avgDistanceFromOthers(survey: RandomSurveyResponse, all: RandomSurveyResponse[]): number {
  const others = all.filter((s) => s.id !== survey.id);
  if (others.length === 0) return 0;

  let total = 0;
  for (const other of others) {
    let dist = 0;
    for (let i = 0; i < survey.scores.length; i++) {
      dist += (survey.scores[i] - other.scores[i]) ** 2;
    }
    total += Math.sqrt(dist);
  }
  return total / others.length;
}

function pickByStats(surveys: RandomSurveyResponse[]): RandomSurveyResponse {
  return surveys.reduce((best, current) =>
    avgDistanceFromOthers(current, surveys) > avgDistanceFromOthers(best, surveys)
      ? current
      : best
  );
}

export async function pickMostHeterogeneous(
  room: RandomRoomData
): Promise<{ survey: RandomSurveyResponse; note: string; usedAi: boolean }> {
  const surveys = room.surveys;
  if (surveys.length === 0) {
    throw new Error("설문 응답이 없습니다.");
  }

  if (hasGemini() && surveys.length >= 2) {
    const roster = surveys
      .map(
        (s) => {
          const excel = s.rosterFields
            ? ` | 학교/명단: ${Object.entries(s.rosterFields)
                .map(([k, v]) => `${k}=${v}`)
                .join("; ")}`
            : s.rosterLabel
              ? ` | 학교=${s.rosterLabel}`
              : "";
          return `- id=${s.id}, 이름=${s.nickname}, 이메일=${s.email}, ${room.abilities.map((a, i) => `${a}=${s.scores[i]}`).join(", ")}${excel}`;
        }
      )
      .join("\n");

    const prompt = `당신은 팀 매칭 AI입니다. 방 주제: ${room.subject}
기준: ${room.abilities.join(", ")}

아래 ${surveys.length}명 중 **그룹 내에서 가장 이질성(다름)이 높은** 1명을 고르세요.
점수 패턴이 다른 사람, 극단값, 다른 성향을 보이는 사람을 우선합니다.

응답자:
${roster}

JSON만 출력:
{"selectedId":"uuid","reason":"한 줄 이유"}`;

    try {
      const raw = await generateText(prompt);
      const parsed = parseJsonFromText(raw) as { selectedId?: string; reason?: string };
      const picked = surveys.find((s) => s.id === parsed.selectedId);
      if (picked) {
        return {
          survey: picked,
          note: parsed.reason?.trim() || "AI가 가장 이질성이 높은 참가자를 선정했습니다.",
          usedAi: true,
        };
      }
    } catch {
      /* fallback */
    }
  }

  const picked = pickByStats(surveys);
  return {
    survey: picked,
    note: "점수 분포 기준으로 가장 이질성이 높은 참가자를 선정했습니다.",
    usedAi: false,
  };
}
