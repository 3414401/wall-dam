import * as XLSX from "xlsx";
import type { RosterData, RosterRow } from "./types.js";

const MAX_ROWS = 5000;

export function parseRosterBuffer(
  buffer: Buffer,
  fileName: string
): RosterData {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const table = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];

  if (table.length < 2) {
    throw new Error("엑셀에 헤더와 최소 1행의 데이터가 필요합니다.");
  }

  const headerRow = table[0].map((c) => String(c ?? "").trim());
  const columns = headerRow.map((h, i) => h || `열${i + 1}`);
  const rows: RosterRow[] = [];

  for (let i = 1; i < table.length && rows.length < MAX_ROWS; i++) {
    const raw = table[i].map((c) => String(c ?? "").trim());
    if (raw.every((c) => !c)) continue;

    const cells: Record<string, string> = {};
    columns.forEach((col, idx) => {
      cells[col] = raw[idx] ?? "";
    });

    const schoolName = (cells["학교명"] ?? "").trim();
    const city = (cells["도시명"] ?? "").trim();
    const district = (cells["시군구"] ?? "").trim();
    const columnA = (raw[0] ?? "").trim() || cells[columns[0]] || "";
    const label =
      schoolName ||
      [city, district, columnA].filter(Boolean).join(" ") ||
      "이름 없음";

    rows.push({
      id: `row-${i}`,
      label,
      cells,
    });
  }

  if (rows.length === 0) {
    throw new Error("유효한 데이터 행이 없습니다.");
  }

  return {
    fileName,
    columns,
    rows,
    uploadedAt: new Date().toISOString(),
  };
}

export function searchRoster(
  roster: RosterData,
  query: string,
  limit = 30
): RosterRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return roster.rows.slice(0, limit);

  return roster.rows
    .filter((row) => {
      const school = (row.cells["학교명"] ?? row.label).toLowerCase();
      const city = (row.cells["도시명"] ?? "").toLowerCase();
      const district = (row.cells["시군구"] ?? "").toLowerCase();
      return (
        school.includes(q) ||
        city.includes(q) ||
        district.includes(q) ||
        row.label.toLowerCase().includes(q)
      );
    })
    .slice(0, limit);
}

export function rosterRowToText(row: RosterRow): string {
  return Object.entries(row.cells)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}
