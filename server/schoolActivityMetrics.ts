/** schools.xlsx / roster 에서 조별 추천활동에 쓰는 열 */
export const SCHOOL_ACTIVITY_COLUMNS = [
  "사회 문화 획일성 지수",
  "소비 1위 업종",
  "소비 2위 업종",
  "소비 3위 업종",
] as const;

export type SchoolActivityColumn = (typeof SCHOOL_ACTIVITY_COLUMNS)[number];

export interface SchoolActivityMetrics {
  학교명?: string;
  도시명?: string;
  시군구?: string;
  "사회 문화 획일성 지수"?: string;
  "소비 1위 업종"?: string;
  "소비 2위 업종"?: string;
  "소비 3위 업종"?: string;
}

/** 설문에 저장된 rosterFields에서 추천활동용 지표만 추출 */
export function pickSchoolActivityMetrics(
  fields?: Record<string, string> | null
): SchoolActivityMetrics | null {
  if (!fields) return null;

  const metrics: SchoolActivityMetrics = {};
  const school = (fields["학교명"] ?? "").trim();
  const city = (fields["도시명"] ?? "").trim();
  const district = (fields["시군구"] ?? "").trim();
  if (school) metrics["학교명"] = school;
  if (city) metrics["도시명"] = city;
  if (district) metrics["시군구"] = district;

  for (const col of SCHOOL_ACTIVITY_COLUMNS) {
    const v = (fields[col] ?? "").trim();
    if (v) metrics[col] = v;
  }

  return Object.keys(metrics).length > 0 ? metrics : null;
}

/** AI 프롬프트용 한 줄 요약 */
export function formatSchoolActivityLine(
  metrics: SchoolActivityMetrics | null
): string {
  if (!metrics) return "(학교 정보 없음)";
  const parts: string[] = [];
  if (metrics["학교명"]) parts.push(`학교=${metrics["학교명"]}`);
  for (const col of SCHOOL_ACTIVITY_COLUMNS) {
    const v = metrics[col];
    if (v) parts.push(`${col}=${v}`);
  }
  return parts.length ? parts.join("; ") : "(학교 지표 없음)";
}

/**
 * AI 없이 쓸 때: 조원 학교의 소비 업종·사회문화 지수를 바탕으로
 * 간단한 추천활동 문구를 만든다.
 */
export function fallbackRecommendedActivity(
  members: { rosterFields?: Record<string, string> | null }[],
  purpose?: string
): string {
  const industries: string[] = [];
  const seen = new Set<string>();
  let maxHomogeneity: number | null = null;

  for (const m of members) {
    const metrics = pickSchoolActivityMetrics(m.rosterFields);
    if (!metrics) continue;

    for (const col of ["소비 1위 업종", "소비 2위 업종", "소비 3위 업종"] as const) {
      const v = metrics[col]?.trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        industries.push(v);
      }
    }

    const hRaw = metrics["사회 문화 획일성 지수"];
    if (hRaw) {
      const h = Number(hRaw);
      if (!Number.isNaN(h)) {
        maxHomogeneity =
          maxHomogeneity === null ? h : Math.max(maxHomogeneity, h);
      }
    }
  }

  const purposeLabel = purpose?.trim() || "팀 프로젝트";

  if (industries.length > 0) {
    const top = industries.slice(0, 3).join(" · ");
    const diversityHint =
      maxHomogeneity !== null && maxHomogeneity >= 0.9
        ? "학교 사회·문화 배경이 비슷한 편이니, 업종 밖에서 역할을 바꿔 가며 "
        : "서로 다른 소비·문화 배경을 살려 ";
    return `${diversityHint}${top} 관련 사례를 함께 조사·발표하는 활동을 추천합니다. (${purposeLabel})`;
  }

  if (maxHomogeneity !== null) {
    if (maxHomogeneity >= 0.9) {
      return `사회·문화 배경이 비슷한 조이므로, ${purposeLabel}에서 반대 관점 역할을 나눠 토론하는 활동을 추천합니다.`;
    }
    return `사회·문화 배경이 다양한 조이므로, ${purposeLabel}에서 각자 학교·지역 경험을 공유하는 아이스브레이킹을 추천합니다.`;
  }

  return `${purposeLabel}에 맞는 역할 분담 토의와 10분 아이스브레이킹을 추천합니다.`;
}

/** 추천활동 작성 시 AI에게 넣는 공통 지침 */
export const SCHOOL_ACTIVITY_PROMPT_RULES = `조별 추천활동(recommendedActivity) 작성 규칙:
- 각 조원 excelRow / schoolActivity에 있는 「사회 문화 획일성 지수」「소비 1위 업종」「소비 2위 업종」「소비 3위 업종」을 반드시 참고한다.
- 소비 업종이 있으면 그 업종(또는 조원 업종의 공통·대비)과 연결된 구체적 팀 활동을 제안한다.
- 사회 문화 획일성 지수가 높은 조는 관점 차이를 만드는 역할극·반대토론을, 낮은(다양한) 조는 경험 공유·교차 인터뷰를 우선한다.
- 학교 정보가 없는 조원은 설문 점수와 조 목적만으로 활동을 제안한다.
- 추천활동은 한국어 1문장, 40~80자 정도로 구체적으로.`;
