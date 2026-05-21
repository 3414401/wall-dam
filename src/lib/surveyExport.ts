import type { SessionData } from "./api";

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

/** Excel에서 바로 열 수 있는 CSV (UTF-8 BOM) */
export function downloadSessionExcel(session: SessionData): void {
  const lines: string[] = [];
  const date = new Date().toISOString().slice(0, 10);

  lines.push(`세션 코드,${session.code}`);
  lines.push(`능력치,${session.abilities.join(" / ")}`);
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
    const surveyMap = new Map(session.surveys.map((s) => [s.id, s]));
    lines.push("");
    lines.push("=== 조 배치 결과 ===");
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
  }

  const filename = `wall-dam_${session.code}_${date}.csv`;
  triggerDownload(filename, lines.join("\r\n"));
}
