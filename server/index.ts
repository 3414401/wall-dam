import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { balanceTeams } from "./balance.js";
import { loadSession, saveSession, useGitHub } from "./storage.js";
import type { SessionData, SurveyResponse } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    storage: useGitHub() ? "github" : "local",
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
    };

    await saveSession(session);
    res.json({ code, session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "세션 생성에 실패했습니다." });
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

app.post("/api/sessions/:code/surveys", async (req, res) => {
  try {
    const session = await loadSession(req.params.code);
    if (!session) {
      res.status(404).json({ error: "코드를 찾을 수 없습니다." });
      return;
    }

    const { nickname, scores } = req.body as {
      nickname?: string;
      scores?: number[];
    };

    if (!nickname?.trim()) {
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
      nickname: nickname.trim(),
      scores: scores.map((s) => Math.round(s)),
      submittedAt: new Date().toISOString(),
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
    await saveSession(session);

    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "조 배치에 실패했습니다." });
  }
});

app.listen(PORT, () => {
  console.log(`API server http://localhost:${PORT}`);
  console.log(`Storage: ${useGitHub() ? "GitHub" : "local (server-data/)"}`);
});
