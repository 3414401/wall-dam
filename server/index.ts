import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { balanceTeamsWithAi } from "./aiBalance.js";
import { balanceTeams } from "./balance.js";
import { getExcelReferenceText } from "./excelReference.js";
import { hasGemini, probeGeminiModel } from "./gemini.js";
import { buildSessionInsights } from "./homogeneity.js";
import { getGlobalRoster } from "./globalRoster.js";
import { getRosterAiGuideText } from "./rosterAiGuide.js";
import { searchRoster } from "./rosterParse.js";
import { pickMostHeterogeneous } from "./randomMatch.js";
import {
  deleteRandomRoom,
  listRandomRoomCodes,
  loadRandomRoom,
  saveRandomRoom,
} from "./randomRoomStorage.js";
import { loadSession, saveSession, useGitHub, findSessionByInsightsCode } from "./storage.js";
import type {
  RandomRoomData,
  RandomRoomPublic,
  SessionData,
  SurveyResponse,
} from "./types.js";
import { RANDOM_CRITERION1, RANDOM_SUBJECTS } from "./types.js";

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

function publicSession(session: SessionData) {
  const { insightsCode: _secret, ...rest } = session;
  return rest;
}

async function generateUniqueSessionCodes(): Promise<{
  code: string;
  insightsCode: string;
}> {
  for (let i = 0; i < 20; i++) {
    const code = generateCode();
    let insightsCode = generateCode();
    while (insightsCode === code) {
      insightsCode = generateCode();
    }
    const existing = await loadSession(code);
    const insightsTaken = await findSessionByInsightsCode(insightsCode);
    if (!existing && !insightsTaken) {
      return { code, insightsCode };
    }
  }
  return { code: generateCode(), insightsCode: generateCode() };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toPublicRoom(room: RandomRoomData): RandomRoomPublic {
  return {
    code: room.code,
    subject: room.subject,
    criterion3: room.criterion3,
    criterion4: room.criterion4,
    createdAt: room.createdAt,
    createdBy: room.createdBy,
    participantCount: room.surveys.length,
    maxParticipants: room.maxParticipants,
    joinClosed: room.joinClosed,
    selectedEmail: room.selectedEmail,
    matchedAt: room.matchedAt,
  };
}

async function runRandomMatch(room: RandomRoomData): Promise<RandomRoomData> {
  const { survey, note } = await pickMostHeterogeneous(room);
  room.selectedEmail = survey.email;
  room.matchedAt = new Date().toISOString();
  room.matchNote = note;
  room.joinClosed = true;

  room.messages.push({
    id: uuidv4(),
    authorName: "월담 AI",
    body: `선정된 이메일: ${survey.email}\n이 이메일로 입장코드를 보내세요.`,
    createdAt: new Date().toISOString(),
    system: true,
  });

  return room;
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
  const rosterGuide = await getRosterAiGuideText();
  const geminiModel = hasGemini() ? await probeGeminiModel() : null;
  res.json({
    ok: true,
    storage: useGitHub() ? "github" : "local",
    ai: hasGemini(),
    geminiOk: Boolean(geminiModel),
    geminiModel,
    excel: excel.length > 0,
    roster: Boolean(roster?.rows.length),
    rosterRows: roster?.rows.length ?? 0,
    rosterAiGuide: rosterGuide.length > 0,
  });
});

app.post("/api/sessions", async (req, res) => {
  try {
    const { abilities, createdBy, teamPurpose } = req.body as {
      abilities?: string[];
      createdBy?: string;
      teamPurpose?: string;
    };

    if (!abilities || abilities.length !== 4) {
      res.status(400).json({ error: "능력치 4개를 입력해 주세요." });
      return;
    }

    const trimmed = abilities.map((a) => String(a).trim());
    if (trimmed.some((a) => !a)) {
      res.status(400).json({ error: "모든 능력치 이름을 입력해 주세요." });
      return;
    }

    let { code, insightsCode } = await generateUniqueSessionCodes();

    const session: SessionData = {
      code,
      insightsCode,
      abilities: trimmed,
      teamPurpose: String(teamPurpose ?? "").trim(),
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "host",
      surveys: [],
      teamCount: 4,
      groups: null,
      balancedAt: null,
      balanceMethod: null,
      aiBalanceNote: null,
      aiTeamExplanations: null,
      insights: null,
      roster: null,
    };

    await saveSession(session);
    res.json({ code, insightsCode, session: publicSession(session) });
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
    res.json({ session: publicSession(session) });
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
      rosterFields = row.cells;
      rosterLabel = row.label;
      if (!displayName) {
        displayName = row.label;
      } else if (!displayName.includes(row.label)) {
        displayName = `${displayName} (${row.label})`;
      }
    } else if (!displayName) {
      res.status(400).json({ error: "닉네임을 입력해 주세요." });
      return;
    }

    if (!scores || scores.length !== session.abilities.length) {
      res.status(400).json({
        error: `${session.abilities.length}개 능력치 점수를 모두 입력해 주세요.`,
      });
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
    session.aiTeamExplanations = null;
    await saveSession(session);

    res.json({ session: publicSession(session) });
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
    session.aiBalanceNote = result.usedAi ? result.note : "자동 균형 배치";
    session.aiTeamExplanations = result.teamExplanations.map((t) => ({
      teamIndex: t.teamIndex,
      comment: t.reason?.trim() || `${t.teamIndex}조 배치`,
    }));
    try {
      session.insights = await buildSessionInsights(session);
    } catch (insightErr) {
      console.error("insights after AI balance", insightErr);
    }
    await saveSession(session);

    res.json({
      session: publicSession(session),
      note: result.note,
      teamExplanations: session.aiTeamExplanations,
      usedAi: result.usedAi,
    });
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

    const { insightsCode } = req.body as { insightsCode?: string };
    const provided = String(insightsCode ?? "").replace(/\D/g, "");
    if (!session.insightsCode) {
      res.status(400).json({
        error: "이 세션에는 AI 요약 코드가 없습니다. 설문을 새로 만들어 주세요.",
      });
      return;
    }
    if (provided !== session.insightsCode) {
      res.status(403).json({ error: "AI 요약 코드가 올바르지 않습니다." });
      return;
    }

    if (session.surveys.length < 2) {
      res.status(400).json({ error: "분석에는 최소 2명의 설문이 필요합니다." });
      return;
    }

    session.insights = await buildSessionInsights(session);
    await saveSession(session);

    res.json({ insights: session.insights, session: publicSession(session) });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "분석에 실패했습니다.";
    res.status(500).json({ error: msg });
  }
});

app.post("/api/insights", async (req, res) => {
  try {
    const { insightsCode } = req.body as { insightsCode?: string };
    const provided = String(insightsCode ?? "").replace(/\D/g, "");
    if (provided.length !== 6) {
      res.status(400).json({ error: "AI 요약 코드 6자리를 입력해 주세요." });
      return;
    }

    const session = await findSessionByInsightsCode(provided);
    if (!session) {
      res.status(404).json({ error: "AI 요약 코드를 찾을 수 없습니다." });
      return;
    }

    if (session.surveys.length < 2) {
      res.status(400).json({ error: "분석에는 최소 2명의 설문이 필요합니다." });
      return;
    }

    session.insights = await buildSessionInsights(session);
    await saveSession(session);

    res.json({ insights: session.insights, session: publicSession(session) });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "분석에 실패했습니다.";
    res.status(500).json({ error: msg });
  }
});

app.get("/api/random-rooms", async (_req, res) => {
  try {
    const codes = await listRandomRoomCodes();
    const rooms: RandomRoomPublic[] = [];

    for (const code of codes) {
      const room = await loadRandomRoom(code);
      if (room) rooms.push(toPublicRoom(room));
    }

    rooms.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({ rooms });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "방 목록 조회에 실패했습니다." });
  }
});

app.post("/api/random-rooms", async (req, res) => {
  try {
    const { subject, criterion3, criterion4, recipientEmail, createdBy } =
      req.body as {
        subject?: string;
        criterion3?: string;
        criterion4?: string;
        recipientEmail?: string;
        createdBy?: string;
      };

    if (!subject || !RANDOM_SUBJECTS.includes(subject as (typeof RANDOM_SUBJECTS)[number])) {
      res.status(400).json({ error: "방의 주제를 선택해 주세요." });
      return;
    }

    const c3 = String(criterion3 ?? "").trim();
    const c4 = String(criterion4 ?? "").trim();
    if (!c3 || !c4) {
      res.status(400).json({ error: "기준 3, 기준 4를 입력해 주세요." });
      return;
    }

    const email = String(recipientEmail ?? "").trim();
    if (!isValidEmail(email)) {
      res.status(400).json({ error: "입장 코드를 받을 이메일을 올바르게 입력해 주세요." });
      return;
    }

    let code = generateCode();
    let entryCode = generateCode();
    for (let i = 0; i < 10; i++) {
      const existing = await loadRandomRoom(code);
      if (!existing) break;
      code = generateCode();
      entryCode = generateCode();
    }

    const room: RandomRoomData = {
      code,
      entryCode,
      subject: subject as RandomRoomData["subject"],
      abilities: [RANDOM_CRITERION1, c3, c4],
      criterion3: c3,
      criterion4: c4,
      recipientEmail: email,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "host",
      surveys: [],
      joinClosed: false,
      maxParticipants: 5,
      selectedEmail: null,
      matchedAt: null,
      matchNote: null,
      messages: [
        {
          id: uuidv4(),
          authorName: "시스템",
          body: `${subject} 주제의 랜덤 팀 채팅방이 열렸습니다. 입장 코드가 필요합니다.`,
          createdAt: new Date().toISOString(),
          system: true,
        },
      ],
    };

    await saveRandomRoom(room);
    res.json({ code, entryCode, room: toPublicRoom(room) });
  } catch (e) {
    console.error(e);
    const raw = e instanceof Error ? e.message : "방 생성에 실패했습니다.";
    res.status(500).json({ error: raw });
  }
});

app.get("/api/random-rooms/:code", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return;
    }

    const entryCode = String(req.query.entryCode ?? "").replace(/\D/g, "");
    const publicRoom = toPublicRoom(room);

    if (entryCode && entryCode === room.entryCode) {
      res.json({
        room: publicRoom,
        abilities: room.abilities,
        messages: room.messages,
        chatAccess: true,
      });
      return;
    }

    res.json({
      room: publicRoom,
      abilities: room.abilities,
      chatAccess: false,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "방 조회에 실패했습니다." });
  }
});

app.get("/api/random-rooms/:code/roster/search", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
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

app.post("/api/random-rooms/:code/surveys", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return;
    }

    if (room.joinClosed) {
      res.status(400).json({ error: "이 방은 더 이상 참여할 수 없습니다." });
      return;
    }

    if (room.surveys.length >= room.maxParticipants) {
      res.status(400).json({ error: "참여 인원이 가득 찼습니다." });
      return;
    }

    const { nickname, email, scores, rosterRowId } = req.body as {
      nickname?: string;
      email?: string;
      scores?: number[];
      rosterRowId?: string;
    };

    let displayName = nickname?.trim() ?? "";
    let rosterFields: Record<string, string> | undefined;
    let rosterLabel: string | undefined;

    const globalRoster = await getGlobalRoster();

    if (globalRoster) {
      if (!rosterRowId) {
        res.status(400).json({ error: "명단에서 학교명을 선택해 주세요." });
        return;
      }
      const row = globalRoster.rows.find((r) => r.id === rosterRowId);
      if (!row) {
        res.status(400).json({ error: "선택한 명단 행을 찾을 수 없습니다." });
        return;
      }
      rosterFields = row.cells;
      rosterLabel = row.label;
      if (!displayName) {
        res.status(400).json({ error: "본인 이름을 입력해 주세요." });
        return;
      }
      if (!displayName.includes(row.label)) {
        displayName = `${displayName} (${row.label})`;
      }
    } else if (!displayName) {
      res.status(400).json({ error: "이름(닉네임)을 입력해 주세요." });
      return;
    }

    const participantEmail = email?.trim() ?? "";
    if (!isValidEmail(participantEmail)) {
      res.status(400).json({ error: "이메일을 올바르게 입력해 주세요." });
      return;
    }

    if (!scores || scores.length !== room.abilities.length) {
      res.status(400).json({
        error: `${room.abilities.length}개 기준 점수를 모두 입력해 주세요.`,
      });
      return;
    }

    const valid = scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 10);
    if (!valid) {
      res.status(400).json({ error: "점수는 0~10 사이여야 합니다." });
      return;
    }

    if (room.surveys.some((s) => s.email.toLowerCase() === participantEmail.toLowerCase())) {
      res.status(400).json({ error: "이미 참여한 이메일입니다." });
      return;
    }

    const response = {
      id: uuidv4(),
      nickname: displayName,
      email: participantEmail,
      scores: scores.map((s) => Math.round(s)),
      submittedAt: new Date().toISOString(),
      ...(rosterRowId ? { rosterRowId, rosterLabel, rosterFields } : {}),
    };

    room.surveys.push(response);

    if (room.surveys.length >= room.maxParticipants) {
      await runRandomMatch(room);
    }

    await saveRandomRoom(room);

    res.json({
      ok: true,
      total: room.surveys.length,
      joinClosed: room.joinClosed,
      matched: room.joinClosed,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "설문 저장에 실패했습니다." });
  }
});

app.post("/api/random-rooms/:code/messages", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return;
    }

    const { entryCode, authorName, body } = req.body as {
      entryCode?: string;
      authorName?: string;
      body?: string;
    };

    const code = String(entryCode ?? "").replace(/\D/g, "");
    if (code !== room.entryCode) {
      res.status(403).json({ error: "입장 코드가 올바르지 않습니다." });
      return;
    }

    const name = authorName?.trim() ?? "";
    const text = body?.trim() ?? "";
    if (!name) {
      res.status(400).json({ error: "이름을 입력해 주세요." });
      return;
    }
    if (!text) {
      res.status(400).json({ error: "메시지를 입력해 주세요." });
      return;
    }

    const message = {
      id: uuidv4(),
      authorName: name,
      body: text,
      createdAt: new Date().toISOString(),
    };

    room.messages.push(message);
    await saveRandomRoom(room);

    res.json({ ok: true, message, messages: room.messages });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "메시지 전송에 실패했습니다." });
  }
});

/** 방 삭제 (호스트용) */
app.delete("/api/random-rooms/:code", async (req, res) => {
  try {
    const code = String(req.params.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: "올바른 방 코드가 아닙니다." });
      return;
    }
    await deleteRandomRoom(code);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "방 삭제에 실패했습니다." });
  }
});

const PURGE_ROOM_CODES = ["872452", "193413", "742344"];

app.listen(PORT, async () => {
  console.log(`API server http://localhost:${PORT}`);
  console.log(`Storage: ${useGitHub() ? "GitHub" : "local (server-data/)"}`);
  console.log(`AI (Gemini): ${hasGemini() ? "enabled" : "disabled"}`);

  for (const code of PURGE_ROOM_CODES) {
    try {
      await deleteRandomRoom(code);
      console.log(`Purged random room ${code}`);
    } catch {
      /* already gone */
    }
  }
});
