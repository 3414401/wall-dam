import type { SessionData, SessionInsights } from "./api";

export function formatSubmittedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsv(row: string[]): string {
  return row.map(escapeCsvCell).join(",");
}

function triggerDownload(filename: string, csvBody: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvBody], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function resolveInsights(
  session: SessionData,
  insights?: SessionInsights | null
): SessionInsights | null {
  return insights ?? session.insights ?? null;
}

/** Excel에서 바로 열 수 있는 CSV (UTF-8 BOM) */
export function downloadSessionExcel(
  session: SessionData,
  insights?: SessionInsights | null
): void {
  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);
  const resolvedInsights = resolveInsights(session, insights);
  const surveyMap = new Map(session.surveys.map((s) => [s.id, s]));

  lines.push(`세션 코드,${session.code}`);
  lines.push(`설문 생성 시간,${formatSubmittedAt(session.createdAt)}`);
  if (session.createdBy) {
    lines.push(`생성자,${session.createdBy}`);
  }
  if (session.teamPurpose?.trim()) {
    lines.push(`조를 짜는 목적,${session.teamPurpose.trim()}`);
  }
  lines.push(`능력치,${session.abilities.join(" / ")}`);
  if (session.balancedAt) {
    lines.push(`조 배치 시간,${formatSubmittedAt(session.balancedAt)}`);
  }
  lines.push("");

  lines.push("=== 설문조사 결과 ===");
  lines.push(
    rowToCsv(["닉네임", "제출시간", ...session.abilities, "합계"])
  );
  for (const s of session.surveys) {
    lines.push(
      rowToCsv([
        s.nickname,
        formatSubmittedAt(s.submittedAt),
        ...s.scores.map(String),
        String(s.scores.reduce((a, b) => a + b, 0)),
      ])
    );
  }

  if (session.groups && session.groups.length > 0) {
    const activityByTeam = new Map<number, string>();
    for (const t of resolvedInsights?.teamComments ?? []) {
      if (t.recommendedActivity?.trim()) {
        activityByTeam.set(t.teamIndex, t.recommendedActivity.trim());
      }
    }

    lines.push("");
    lines.push("=== 조별 구성 · 추천 활동 ===");
    lines.push(rowToCsv(["조", "조원", "추천 활동"]));
    for (const g of session.groups) {
      const members = g.memberIds
        .map((id) => surveyMap.get(id)?.nickname ?? id)
        .join(" / ");
      lines.push(
        rowToCsv([
          `${g.teamIndex}조`,
          members,
          activityByTeam.get(g.teamIndex) ?? "",
        ])
      );
    }

    lines.push("");
    lines.push("=== 조 배치 결과 (점수 상세) ===");
    lines.push(rowToCsv(["조", "닉네임", ...session.abilities]));
    for (const g of session.groups) {
      for (const id of g.memberIds) {
        const m = surveyMap.get(id);
        lines.push(
          rowToCsv([
            `${g.teamIndex}조`,
            m?.nickname ?? id,
            ...(m?.scores.map(String) ?? session.abilities.map(() => "")),
          ])
        );
      }
      lines.push(
        rowToCsv([
          `${g.teamIndex}조 합계`,
          "",
          ...g.totals.map(String),
        ])
      );
    }
  } else if (resolvedInsights?.teamComments?.some((t) => t.recommendedActivity)) {
    lines.push("");
    lines.push("=== 조별 추천 활동 ===");
    lines.push(rowToCsv(["조", "추천 활동"]));
    for (const t of resolvedInsights.teamComments) {
      if (!t.recommendedActivity?.trim()) continue;
      lines.push(
        rowToCsv([`${t.teamIndex}조`, t.recommendedActivity.trim()])
      );
    }
  }

  const filename = `wall-dam_${session.code}_${date}.csv`;
  triggerDownload(filename, lines.join("\r\n"));
}
