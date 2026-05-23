import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { balanceTeamsWithAi } from "./aiBalance.js";
import { balanceTeams } from "./balance.js";
import { getExcelReferenceText } from "./excelReference.js";
import { hasGemini } from "./gemini.js";
import { buildSessionInsights } from "./homogeneity.js";
import { getGlobalRoster } from "./globalRoster.js";
import { searchRoster } from "./rosterParse.js";
import { loadSession, saveSession, useGitHub } from "./storage.js";
import type { SessionData, SurveyResponse } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const corsOrigins = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-zA-Z0-9-]+\.github\.io$/,
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (corsOrigins.some((re) => re.test(origin))) {
        callback(null, true);
        return;
      }
      callback(null, true);
    },
  })
);
app.use(express.json({ limit: "15mb" }));

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "wall-dam-api",
    health: "/api/health",
    storage: useGitHub() ? "github" : "local",
  });
});

app.get("/api/health", async (_req, res) => {
  const excel = await getExcelReferenceText();
  const roster = await getGlobalRoster();
  res.json({
    ok: true,
    storage: useGitHub() ? "github" : "local",
    ai: hasGemini(),
    excel: excel.length > 0,
    roster: Boolean(roster?.rows.length),
    rosterRows: roster?.rows.length ?? 0,
  });
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { abilities, createdBy } = req.body as {
      abilities?: string[];
      createdBy?: string;
    };

    if (!abilities || abilities.length !== 5) {
      res.status(400).json({ error: "능력치 5개를 입력해 주세요." });
      return;
    }

    const trimmed = abilities.map((a) => String(a).trim());
    if (trimmed.some((a) => !a)) {
      res.status(400).json({ error: "모든 능력치 이름을 입력해 주세요." });
      return;
    }

    let code = generateCode();
    for (let i = 0; i < 10; i++) {
      const existing = await loadSession(code);
      if (!existing) break;
      code = generateCode();
    }

    const session: SessionData = {
      code,
      abilities: trimmed,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "host",
      surveys: [],
      teamCount: 4,
      groups: null,
      balancedAt: null,
      balanceMethod: null,
      aiBalanceNote: null,
      insights: null,
      roster: null,
    };

    await saveSession(session);
    res.json({ code, session });
  } catch (e) {
    console.error(e);
    const raw = e instanceof Error ? e.message : "세션 생성에 실패했습니다.";
    let error = raw;
    if (raw.includes("GitHub API 401") || raw.includes("Bad credentials")) {
      error =
        "GitHub 토큰이 잘못되었습니다. Render의 GITHUB_TOKEN을 새 토큰으로 바꾸고 재배포하세요.";
    } else if (raw.includes("GitHub API 403")) {
      error =
        "GitHub 권한이 없습니다. 토큰에 repo 권한이 있는지, GITHUB_OWNER·GITHUB_REPO가 wall-dam인지 확인하세요.";
    } else if (raw.includes("GitHub API")) {
      error = `GitHub 저장 오류: ${raw}`;
    }
    res.status(500).json({ error });
  }
});

app.get("/api/sessions/:code", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }
    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "세션 조회에 실패했습니다." });
  }
});

app.get("/api/roster/info", async (_req, res) => {
  const roster = await getGlobalRoster();
  if (!roster) {
    res.status(404).json({
      error:
        "영구 명단 파일이 없습니다. GitHub에 data/roster.xlsx (또는 roster.csv)를 올려 주세요.",
    });
    return;
  }
  res.json({
    fileName: roster.fileName,
    rowCount: roster.rows.length,
    columns: roster.columns,
    uploadedAt: roster.uploadedAt,
  });
});

app.get("/api/sessions/:code/roster/search", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    const roster = await getGlobalRoster();
    if (!roster) {
      res.status(400).json({
        error:
          "영구 명단이 설정되지 않았습니다. GitHub data/roster.xlsx 를 확인하세요.",
      });
      return;
    }

    const q = String(req.query.q ?? "");
    const defaultLimit = q.trim() ? 30 : 500;
    const limit = Math.min(500, Number(req.query.limit) || defaultLimit);
    const results = searchRoster(roster, q, limit);

    res.json({ results, total: roster.rows.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "명단 검색 실패" });
  }
});

app.get("/api/sessions/:code/roster/row/:rowId", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    const roster = await getGlobalRoster();
    if (!roster) {
      res.status(404).json({ error: "영구 명단을 찾을 수 없습니다." });
      return;
    }
    const row = roster.rows.find((r) => r.id === req.params.rowId);
    if (!row) {
      res.status(404).json({ error: "해당 행을 찾을 수 없습니다." });
      return;
    }
    res.json({ row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "행 조회 실패" });
  }
});

app.post("/api/sessions/:code/surveys", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    const { nickname, scores, rosterRowId } = req.body as {
      nickname?: string;
      scores?: number[];
      rosterRowId?: string;
    };

    let displayName = nickname?.trim() ?? "";
    let rosterFields: Record<string, string> | undefined;
    let rosterLabel: string | undefined;

    const globalRoster = await getGlobalRoster();

    if (globalRoster) {
      if (!rosterRowId) {
        res.status(400).json({ error: "명단에서 본인을 선택해 주세요." });
        return;
      }
      const row = globalRoster.rows.find((r) => r.id === rosterRowId);
      if (!row) {
        res.status(400).json({ error: "선택한 명단 행을 찾을 수 없습니다." });
        return;
      }
      const taken = session.surveys.some((s) => s.rosterRowId === rosterRowId);
      if (taken) {
        res.status(400).json({ error: "이미 다른 사람이 선택한 항목입니다." });
        return;
      }
      rosterFields = row.cells;
      rosterLabel = row.label;
      displayName = row.label;
    } else if (!displayName) {
      res.status(400).json({ error: "닉네임을 입력해 주세요." });
      return;
    }

    if (!scores || scores.length !== 5) {
      res.status(400).json({ error: "5개 능력치 점수를 모두 입력해 주세요." });
      return;
    }

    const valid = scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 10);
    if (!valid) {
      res.status(400).json({ error: "점수는 0~10 사이여야 합니다." });
      return;
    }

    const response: SurveyResponse = {
      id: uuidv4(),
      nickname: displayName,
      scores: scores.map((s) => Math.round(s)),
      submittedAt: new Date().toISOString(),
      ...(rosterRowId
        ? { rosterRowId, rosterLabel, rosterFields }
        : {}),
    };

    session.surveys.push(response);
    session.groups = null;
    session.balancedAt = null;
    await saveSession(session);

    res.json({ ok: true, survey: response, total: session.surveys.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "설문 저장에 실패했습니다." });
  }
});

app.post("/api/sessions/:code/balance", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    if (session.surveys.length < 2) {
      res.status(400).json({ error: "조 배치에는 최소 2명의 설문이 필요합니다." });
      return;
    }

    const { teamCount } = req.body as { teamCount?: number };
    const count = Math.max(
      2,
      Math.min(Number(teamCount) || session.teamCount || 4, session.surveys.length)
    );

    session.teamCount = count;
    session.groups = balanceTeams(session.surveys, count);
    session.balancedAt = new Date().toISOString();
    session.balanceMethod = "greedy";
    session.aiBalanceNote = null;
    await saveSession(session);

    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "조 배치에 실패했습니다." });
  }
});

app.post("/api/sessions/:code/balance-ai", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    if (session.surveys.length < 2) {
      res.status(400).json({ error: "조 배치에는 최소 2명의 설문이 필요합니다." });
      return;
    }

    const { teamCount } = req.body as { teamCount?: number };
    const count = Math.max(
      2,
      Math.min(Number(teamCount) || session.teamCount || 4, session.surveys.length)
    );

    const result = await balanceTeamsWithAi(session, count);
    session.teamCount = count;
    session.groups = result.groups;
    session.balancedAt = new Date().toISOString();
    session.balanceMethod = result.usedAi ? "ai" : "greedy";
    session.aiBalanceNote = result.note;
    session.insights = await buildSessionInsights(session);
    await saveSession(session);

    res.json({ session, note: result.note, usedAi: result.usedAi });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "AI 조 배치에 실패했습니다.";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/sessions/:code/insights", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    if (session.surveys.length < 2) {
      res.status(400).json({ error: "분석에는 최소 2명의 설문이 필요합니다." });
      return;
    }

    session.insights = await buildSessionInsights(session);
    await saveSession(session);

    res.json({ insights: session.insights, session });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "분석에 실패했습니다.";
    res.status(500).json({ error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`API server http://localhost:${PORT}`);
  console.log(`Storage: ${useGitHub() ? "GitHub" : "local (server-data/)"}`);
  console.log(`AI (Gemini): ${hasGemini() ? "enabled" : "disabled"}`);
});
