import { balanceTeamsWithAi } from "./aiBalance.js";
import { fallbackRecommendedActivity } from "./schoolActivityMetrics.js";
import type {
  RandomRoomData,
  RandomSurveyResponse,
  SessionData,
  SurveyResponse,
  TeamGroup,
} from "./types.js";

export interface DiversityPairMember {
  id: string;
  nickname: string;
  email: string;
}

export interface DiversityPair {
  pairIndex: number;
  members: DiversityPairMember[];
  reason?: string;
  recommendedActivity?: string;
}

export interface DiversityMatchResult {
  pairs: DiversityPair[];
  leftover: DiversityPairMember[];
  note: string;
  usedAi: boolean;
}

function toSurveyResponse(s: RandomSurveyResponse): SurveyResponse {
  return {
    id: s.id,
    nickname: s.nickname,
    scores: s.scores,
    submittedAt: s.submittedAt,
    rosterRowId: s.rosterRowId,
    rosterLabel: s.rosterLabel,
    rosterFields: s.rosterFields,
  };
}

function scoreDistance(a: SurveyResponse, b: SurveyResponse): number {
  let dist = 0;
  for (let i = 0; i < a.scores.length; i++) {
    dist += (a.scores[i] - b.scores[i]) ** 2;
  }
  return Math.sqrt(dist);
}

/** 점수 거리 최대화 그리디 페어 (보정·폴백용) */
function greedyMaxDistancePairs(surveys: SurveyResponse[]): TeamGroup[] {
  const remaining = [...surveys];
  const groups: TeamGroup[] = [];
  let idx = 1;

  while (remaining.length >= 2) {
    let bestI = 0;
    let bestJ = 1;
    let bestD = -1;
    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const d = scoreDistance(remaining[i], remaining[j]);
        if (d > bestD) {
          bestD = d;
          bestI = i;
          bestJ = j;
        }
      }
    }
    const a = remaining[bestI];
    const b = remaining[bestJ];
    const [hi, lo] = bestJ > bestI ? [bestJ, bestI] : [bestI, bestJ];
    remaining.splice(hi, 1);
    remaining.splice(lo, 1);
    groups.push({
      teamIndex: idx++,
      memberIds: [a.id, b.id],
      totals: a.scores.map((v, i) => v + b.scores[i]),
    });
  }

  return groups;
}

function enforceExactPairs(
  surveys: SurveyResponse[],
  groups: TeamGroup[]
): { pairs: TeamGroup[]; leftoverIds: string[] } {
  const byId = new Map(surveys.map((s) => [s.id, s]));
  const pairs: TeamGroup[] = [];
  const pool: SurveyResponse[] = [];
  let pairIdx = 1;

  for (const g of groups) {
    const members = g.memberIds
      .map((id) => byId.get(id))
      .filter(Boolean) as SurveyResponse[];

    if (members.length === 2) {
      pairs.push({
        teamIndex: pairIdx++,
        memberIds: [members[0].id, members[1].id],
        totals: members[0].scores.map((v, i) => v + members[1].scores[i]),
      });
    } else if (members.length > 2) {
      pairs.push({
        teamIndex: pairIdx++,
        memberIds: [members[0].id, members[1].id],
        totals: members[0].scores.map((v, i) => v + members[1].scores[i]),
      });
      pool.push(...members.slice(2));
    } else {
      pool.push(...members);
    }
  }

  for (const g of greedyMaxDistancePairs(pool)) {
    pairs.push({ ...g, teamIndex: pairIdx++ });
  }

  const assigned = new Set(pairs.flatMap((p) => p.memberIds));
  const leftoverIds = surveys.filter((s) => !assigned.has(s.id)).map((s) => s.id);
  return { pairs, leftoverIds };
}

/**
 * 담을 넘는 조짜기(balanceTeamsWithAi)와 동일한 스택으로
 * 설문·공공데이터(명단) 기반 2인 다양성 페어 매칭.
 */
export async function matchDiversityPairs(
  room: RandomRoomData
): Promise<DiversityMatchResult> {
  if (room.surveys.length < 2) {
    throw new Error("매칭하려면 설문 참가자가 2명 이상 필요합니다.");
  }

  const surveys = room.surveys.map(toSurveyResponse);
  const pairCount = Math.max(1, Math.floor(surveys.length / 2));

  const sessionLike: SessionData = {
    code: room.code,
    abilities: room.abilities,
    teamPurpose: [
      `${room.subject} 랜덤 채팅방 — 다양성 극대화 2인 페어 매칭`,
      "담을 넘는 조짜기와 동일한 기준으로 배치하세요.",
      "각 조(페어)는 반드시 2명이어야 합니다.",
      "설문 점수 합·분포를 균형 있게 맞추고, 학교·지역 등 공공데이터(명단) 지표로 다양성을 높이세요.",
    ].join(" "),
    createdAt: room.createdAt,
    createdBy: room.createdBy,
    surveys,
    teamCount: pairCount,
    groups: null,
    balancedAt: null,
    balanceMethod: null,
    aiBalanceNote: null,
    insights: null,
    roster: null,
  };

  const result = await balanceTeamsWithAi(sessionLike, pairCount);
  const { pairs: groupPairs, leftoverIds } = enforceExactPairs(
    surveys,
    result.groups
  );

  const surveyById = new Map(room.surveys.map((s) => [s.id, s]));
  const explMap = new Map(
    (result.teamExplanations ?? []).map((t) => [
      t.teamIndex,
      {
        reason: t.reason,
        recommendedActivity: t.recommendedActivity,
      },
    ])
  );

  const pairs: DiversityPair[] = groupPairs.map((g, i) => {
    const expl =
      explMap.get(g.teamIndex) ?? explMap.get(i + 1) ?? {
        reason: undefined,
        recommendedActivity: undefined,
      };
    const members = g.memberIds.map((id) => surveyById.get(id)!);
    return {
      pairIndex: i + 1,
      members: members.map((s) => ({
        id: s.id,
        nickname: s.nickname,
        email: s.email,
      })),
      reason: expl.reason,
      recommendedActivity:
        expl.recommendedActivity ||
        fallbackRecommendedActivity(members, sessionLike.teamPurpose),
    };
  });

  const leftover = leftoverIds.map((id) => {
    const s = surveyById.get(id)!;
    return { id: s.id, nickname: s.nickname, email: s.email };
  });

  return {
    pairs,
    leftover,
    note: result.note,
    usedAi: result.usedAi,
  };
}

export function formatDiversityMatchMessage(result: DiversityMatchResult): string {
  const lines = [
    "🤖 AI 다양성 매칭 결과",
    result.usedAi ? "(공공데이터·설문 기반 AI 배치)" : "(자동 균형 배치)",
    "",
  ];

  for (const pair of result.pairs) {
    const names = pair.members.map((m) => m.nickname).join(" × ");
    lines.push(`${pair.pairIndex}조: ${names}`);
    if (pair.reason?.trim()) {
      lines.push(`  · ${pair.reason.trim()}`);
    }
    if (pair.recommendedActivity?.trim()) {
      lines.push(`  · 추천활동: ${pair.recommendedActivity.trim()}`);
    }
  }

  if (result.leftover.length > 0) {
    lines.push("");
    lines.push(
      `대기: ${result.leftover.map((m) => m.nickname).join(", ")}`
    );
  }

  if (result.note?.trim()) {
    lines.push("");
    lines.push(result.note.trim());
  }

  return lines.join("\n");
}

export function formatMatchResultEmail(options: {
  subject: string;
  recipientName: string;
  pairs: DiversityPair[];
  leftover: DiversityPairMember[];
  note: string;
}): string {
  const lines = [
    `안녕하세요, ${options.recipientName}님.`,
    "",
    `월담 랜덤 채팅방(${options.subject}) AI 다양성 매칭 결과입니다.`,
    "",
    "[팀 배치]",
  ];

  for (const pair of options.pairs) {
    lines.push(`· ${pair.pairIndex}조`);
    for (const m of pair.members) {
      lines.push(`  - ${m.nickname} <${m.email}>`);
    }
    if (pair.recommendedActivity?.trim()) {
      lines.push(`  추천활동: ${pair.recommendedActivity.trim()}`);
    }
  }

  if (options.leftover.length > 0) {
    lines.push("");
    lines.push("[대기]");
    for (const m of options.leftover) {
      lines.push(`  - ${m.nickname} <${m.email}>`);
    }
  }

  if (options.note?.trim()) {
    lines.push("");
    lines.push("[AI 요약]");
    lines.push(options.note.trim());
  }

  lines.push("");
  lines.push("이 메일은 채팅방에서 메일 수신에 동의한 구글 로그인 사용자에게만 발송됩니다.");
  return lines.join("\n");
}
