import { readFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { loadGithubFileBinary } from "./githubFile.js";

const EXCEL_PATH =
  process.env.GITHUB_AI_EXCEL_PATH || "data/ai-reference.xlsx";
const CSV_PATH = process.env.GITHUB_AI_CSV_PATH || "data/ai-reference.csv";
const LOCAL_XLSX = path.join(process.cwd(), "data", "ai-reference.xlsx");
const LOCAL_CSV = path.join(process.cwd(), "data", "ai-reference.csv");
const MAX_ROWS = 100;

let cachedExcelText: string | null = null;
let cachedExcelAt = 0;
const CACHE_MS = 60_000;

function rowsToTable(rows: unknown[][]): string {
  if (rows.length === 0) return "(비어 있음)";
  return rows
    .map((row) =>
      (row as unknown[])
        .map((c) => String(c ?? "").replace(/\|/g, "/").trim())
        .join(" | ")
    )
    .join("\n");
}

function bufferToText(buf: Buffer, label: string): string {
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [`[엑셀 파일: ${label}]`];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
    }) as unknown[][];
    const limited = rows.slice(0, MAX_ROWS);
    parts.push(`### 시트 "${sheetName}" (${limited.length}행)`);
    parts.push(rowsToTable(limited));
    if (rows.length > MAX_ROWS) {
      parts.push(`(... ${rows.length - MAX_ROWS}행 생략)`);
    }
  }

  return parts.join("\n");
}

async function loadLocalBuffer(): Promise<{ buf: Buffer; label: string } | null> {
  try {
    const xlsx = await readFile(LOCAL_XLSX);
    return { buf: xlsx, label: "ai-reference.xlsx (로컬)" };
  } catch {
    /* try csv */
  }
  try {
    const csv = await readFile(LOCAL_CSV);
    return { buf: csv, label: "ai-reference.csv (로컬)" };
  } catch {
    return null;
  }
}

async function loadRemoteBuffer(): Promise<{ buf: Buffer; label: string } | null> {
  const xlsx = await loadGithubFileBinary(EXCEL_PATH);
  if (xlsx) return { buf: xlsx, label: "ai-reference.xlsx (GitHub)" };

  const csv = await loadGithubFileBinary(CSV_PATH);
  if (csv) return { buf: csv, label: "ai-reference.csv (GitHub)" };

  return null;
}

/** AI가 참고할 엑셀/CSV 내용 (표 형태 텍스트) */
export async function getExcelReferenceText(): Promise<string> {
  const now = Date.now();
  if (cachedExcelText !== null && now - cachedExcelAt < CACHE_MS) {
    return cachedExcelText;
  }

  const loaded = (await loadRemoteBuffer()) ?? (await loadLocalBuffer());
  if (!loaded) {
    cachedExcelText = "";
    cachedExcelAt = now;
    return "";
  }

  try {
    cachedExcelText = bufferToText(loaded.buf, loaded.label);
  } catch (e) {
    console.error("Excel parse error", e);
    cachedExcelText = "";
  }
  cachedExcelAt = now;
  return cachedExcelText;
}

export function clearExcelReferenceCache() {
  cachedExcelText = null;
  cachedExcelAt = 0;
}
