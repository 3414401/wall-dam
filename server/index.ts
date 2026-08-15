import cors from "cors";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { balanceTeamsWithAi } from "./aiBalance.js";
import { balanceTeams } from "./balance.js";
import { getExcelReferenceText } from "./excelReference.js";
import { hasGemini, probeGeminiModel } from "./gemini.js";
import { buildSessionInsights } from "./homogeneity.js";
import { getGlobalRoster, listCities, listDistricts, listSchools } from "./globalRoster.js";
import { getRosterAiGuideText } from "./rosterAiGuide.js";
import { searchRoster } from "./rosterParse.js";
import { parseChatCityOnlyId } from "./chatSchoolCities.js";
import { fallbackRecommendedActivity } from "./schoolActivityMetrics.js";
import { pickMostHeterogeneous } from "./randomMatch.js";
import { emailProviderLabel, isEmailConfigured, sendMail } from "./email.js";
import {
  formatDiversityMatchMessage,
  formatMatchResultEmail,
  matchDiversityPairs,
} from "./randomPairMatch.js";
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
import { RANDOM_CRITERION1, RANDOM_MAX_PARTICIPANTS, RANDOM_SUBJECTS } from "./types.js";

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

const ROOM_WELCOME_TEXT = "랜덤 팀 채팅방이 열렸습니다.";

function normalizeRoomMessages(room: RandomRoomData) {
  return room.messages.map((msg) => {
    if (
      msg.system &&
      typeof msg.body === "string" &&
      msg.body.includes("랜덤 팀 채팅방이 열렸습니다")
    ) {
      return { ...msg, body: ROOM_WELCOME_TEXT };
    }
    return msg;
  });
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
    body: `선정된 이메일: ${survey.email}\n채팅방에서 이 참가자를 확인해 주세요.`,
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
        "영구 명단 파일이 없습니다. GitHub에 data/schools.xlsx (또는 roster.xlsx)를 올려 주세요.",
    });
    return;
  }
  res.json({
    fileName: roster.fileName,
    rowCount: roster.rows.length,
    columns: roster.columns,
    uploadedAt: roster.uploadedAt,
    cities: listCities(roster),
  });
});

app.get("/api/schools/cities", async (_req, res) => {
  try {
    const roster = await getGlobalRoster();
    if (!roster) {
      res.status(404).json({ error: "학교 데이터가 없습니다." });
      return;
    }
    res.json({ cities: listCities(roster) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "도시 목록 조회 실패" });
  }
});

app.get("/api/schools/districts", async (req, res) => {
  try {
    const city = String(req.query.city ?? "").trim();
    if (!city) {
      res.status(400).json({ error: "도시명을 선택해 주세요." });
      return;
    }
    const roster = await getGlobalRoster();
    if (!roster) {
      res.status(404).json({ error: "학교 데이터가 없습니다." });
      return;
    }
    res.json({ city, districts: listDistricts(roster, city) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "시군구 목록 조회 실패" });
  }
});

app.get("/api/schools/list", async (req, res) => {
  try {
    const city = String(req.query.city ?? "").trim();
    const district = String(req.query.district ?? "").trim();
    if (!city || !district) {
      res.status(400).json({ error: "도시명과 시군구를 선택해 주세요." });
      return;
    }
    const roster = await getGlobalRoster();
    if (!roster) {
      res.status(404).json({ error: "학교 데이터가 없습니다." });
      return;
    }
    const schools = listSchools(roster, city, district);
    res.json({
      city,
      district,
      schools: schools.map((s) => ({
        id: s.id,
        school: s.school,
        label: s.label,
        cells: s.cells,
      })),
      total: schools.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "학교 목록 조회 실패" });
  }
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

    const { nickname, scores, rosterRowId, skipSchool } = req.body as {
      nickname?: string;
      scores?: number[];
      rosterRowId?: string;
      skipSchool?: boolean;
    };

    let displayName = nickname?.trim() ?? "";
    let rosterFields: Record<string, string> | undefined;
    let rosterLabel: string | undefined;

    const globalRoster = await getGlobalRoster();

    if (globalRoster && !skipSchool) {
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

    const explByTeam = new Map(
      result.teamExplanations.map((t) => [t.teamIndex, t])
    );
    session.aiTeamExplanations = result.groups.map((g) => {
      const expl = explByTeam.get(g.teamIndex);
      const members = g.memberIds
        .map((id) => session.surveys.find((s) => s.id === id))
        .filter(Boolean);
      return {
        teamIndex: g.teamIndex,
        comment: expl?.reason?.trim() || `${g.teamIndex}조 배치`,
        recommendedActivity:
          expl?.recommendedActivity?.trim() ||
          fallbackRecommendedActivity(members, session.teamPurpose),
      };
    });

    try {
      session.insights = await buildSessionInsights(session);
      // 인사이트에 더 구체적 추천이 있으면 반영
      for (const t of session.aiTeamExplanations) {
        const fromInsight = session.insights?.teamComments?.find(
          (c) => c.teamIndex === t.teamIndex
        );
        if (fromInsight?.recommendedActivity?.trim()) {
          t.recommendedActivity = fromInsight.recommendedActivity.trim();
        }
      }
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
    const { subject, criterion3, criterion4, createdBy } =
      req.body as {
        subject?: string;
        criterion3?: string;
        criterion4?: string;
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

    let code = generateCode();
    for (let i = 0; i < 10; i++) {
      const existing = await loadRandomRoom(code);
      if (!existing) break;
      code = generateCode();
    }

    const room: RandomRoomData = {
      code,
      subject: subject as RandomRoomData["subject"],
      abilities: [RANDOM_CRITERION1, c3, c4],
      criterion3: c3,
      criterion4: c4,
      recipientEmail: "",
      createdAt: new Date().toISOString(),
      createdBy: createdBy || "host",
      surveys: [],
      joinClosed: false,
      maxParticipants: RANDOM_MAX_PARTICIPANTS,
      selectedEmail: null,
      matchedAt: null,
      matchNote: null,
      messages: [
        {
          id: uuidv4(),
          authorName: "시스템",
          body: ROOM_WELCOME_TEXT,
          createdAt: new Date().toISOString(),
          system: true,
        },
      ],
    };

    await saveRandomRoom(room);
    res.json({ code, room: toPublicRoom(room) });
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

    res.json({
      room: toPublicRoom(room),
      abilities: room.abilities,
      messages: normalizeRoomMessages(room),
      chatAccess: true,
      diversityMatch: room.diversityPairs
        ? {
            pairs: room.diversityPairs,
            leftover: room.diversityLeftover ?? [],
            note: room.diversityMatchNote ?? "",
            usedAi: !!room.diversityUsedAi,
            matchedAt: room.diversityMatchedAt ?? null,
          }
        : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "방 조회에 실패했습니다." });
  }
});

app.post("/api/random-rooms/:code/diversity-match", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return;
    }

    if (room.surveys.length < 2) {
      res.status(400).json({
        error: "매칭하려면 설문 참가자가 2명 이상 필요합니다.",
      });
      return;
    }

    const result = await matchDiversityPairs(room);
    room.diversityPairs = result.pairs;
    room.diversityLeftover = result.leftover;
    room.diversityMatchedAt = new Date().toISOString();
    room.diversityMatchNote = result.note;
    room.diversityUsedAi = result.usedAi;

    room.messages.push({
      id: uuidv4(),
      authorName: "월담 AI",
      body: formatDiversityMatchMessage(result),
      createdAt: new Date().toISOString(),
      system: true,
    });

    room.messages.push({
      id: uuidv4(),
      authorName: "월담 AI",
      body: "팀원의 메일 주소를 내 메일로 받아보겠습니까? (구글 계정으로 로그인한 사용자 한정)",
      createdAt: new Date().toISOString(),
      system: true,
      kind: "email_opt_in",
      matchAt: room.diversityMatchedAt,
    });

    // 새 매칭이면 이전 메일 동의 응답은 유지하되, 이번 matchAt 기준으로 다시 받을 수 있음
    await saveRandomRoom(room);

    res.json({
      ok: true,
      pairs: result.pairs,
      leftover: result.leftover,
      note: result.note,
      usedAi: result.usedAi,
      matchedAt: room.diversityMatchedAt,
      messages: normalizeRoomMessages(room),
    });
  } catch (e) {
    console.error(e);
    const raw = e instanceof Error ? e.message : "다양성 매칭에 실패했습니다.";
    res.status(500).json({ error: raw });
  }
});

app.post("/api/random-rooms/:code/presence", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return;
    }

    const { email, username } = req.body as {
      email?: string;
      username?: string;
    };
    const normalized = String(email ?? "").trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      res.status(400).json({ error: "유효한 구글 이메일이 필요합니다." });
      return;
    }

    const now = new Date().toISOString();
    const list = room.googleParticipants ?? [];
    const existing = list.find((p) => p.email.toLowerCase() === normalized);
    if (existing) {
      existing.lastSeenAt = now;
      if (username?.trim()) existing.username = username.trim();
    } else {
      list.push({
        email: normalized,
        username: username?.trim() || normalized,
        joinedAt: now,
        lastSeenAt: now,
      });
    }
    room.googleParticipants = list;
    await saveRandomRoom(room);
    res.json({ ok: true, count: list.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "참가 등록에 실패했습니다." });
  }
});

app.post("/api/random-rooms/:code/email-match-results", async (req, res) => {
  try {
    const room = await loadRandomRoom(req.params.code);
    if (!room) {
      res.status(404).json({ error: "방을 찾을 수 없습니다." });
      return;
    }

    const { email, accept, matchAt } = req.body as {
      email?: string;
      accept?: boolean;
      matchAt?: string;
    };

    const normalized = String(email ?? "").trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      res.status(400).json({ error: "유효한 구글 이메일이 필요합니다." });
      return;
    }

    const googleUser = (room.googleParticipants ?? []).find(
      (p) => p.email.toLowerCase() === normalized
    );
    if (!googleUser) {
      res.status(403).json({
        error: "구글 계정으로 이 채팅방에 들어온 사용자만 요청할 수 있습니다.",
      });
      return;
    }

    const targetMatchAt = matchAt || room.diversityMatchedAt || "";
    if (!targetMatchAt || !room.diversityPairs?.length) {
      res.status(400).json({ error: "아직 다양성 매칭 결과가 없습니다." });
      return;
    }

    const optIns = room.emailOptIns ?? [];
    const already = optIns.find(
      (o) =>
        o.email.toLowerCase() === normalized && o.matchAt === targetMatchAt
    );
    if (already?.mailedAt) {
      res.json({
        ok: true,
        already: true,
        messages: normalizeRoomMessages(room),
      });
      return;
    }

    if (!accept) {
      optIns.push({
        email: normalized,
        accept: false,
        respondedAt: new Date().toISOString(),
        matchAt: targetMatchAt,
      });
      room.emailOptIns = optIns;
      await saveRandomRoom(room);
      res.json({
        ok: true,
        accepted: false,
        messages: normalizeRoomMessages(room),
      });
      return;
    }

    if (!isEmailConfigured()) {
      res.status(503).json({
        error:
          "메일 발송 설정이 없습니다. Render에 RESEND_API_KEY와 EMAIL_FROM을 넣어 주세요. (Gmail SMTP는 Render에서 자주 실패합니다)",
      });
      return;
    }

    // 예 클릭 → 요청자 우선, 이어서 방의 구글 참가자에게 발송
    const allRecipients = room.googleParticipants ?? [];
    if (allRecipients.length === 0) {
      res.status(400).json({
        error: "메일을 받을 구글 로그인 참가자가 없습니다.",
      });
      return;
    }

    const recipients = [
      ...allRecipients.filter((r) => r.email.toLowerCase() === normalized),
      ...allRecipients.filter((r) => r.email.toLowerCase() !== normalized),
    ];

    const pairs = room.diversityPairs;
    const leftover = room.diversityLeftover ?? [];
    const note = room.diversityMatchNote ?? "";
    const mailed: string[] = [];
    const failed: string[] = [];
    let lastError = "";

    for (const recipient of recipients) {
      const prior = optIns.find(
        (o) =>
          o.email.toLowerCase() === recipient.email.toLowerCase() &&
          o.matchAt === targetMatchAt &&
          o.mailedAt
      );
      if (prior) {
        mailed.push(recipient.email);
        continue;
      }

      try {
        await sendMail({
          to: recipient.email,
          subject: `[월담] ${room.subject} 다양성 매칭 결과`,
          text: formatMatchResultEmail({
            subject: room.subject,
            recipientName: recipient.username,
            pairs,
            leftover,
            note,
          }),
        });
        mailed.push(recipient.email);
        const existingIdx = optIns.findIndex(
          (o) =>
            o.email.toLowerCase() === recipient.email.toLowerCase() &&
            o.matchAt === targetMatchAt
        );
        const entry = {
          email: recipient.email.toLowerCase(),
          accept: true,
          respondedAt: new Date().toISOString(),
          matchAt: targetMatchAt,
          mailedAt: new Date().toISOString(),
        };
        if (existingIdx >= 0) optIns[existingIdx] = entry;
        else optIns.push(entry);
      } catch (err) {
        console.error("mail fail", recipient.email, err);
        failed.push(recipient.email);
        lastError = err instanceof Error ? err.message : String(err);
        // SMTP가 막힌 경우 전원 실패 가능성이 크므로 빠르게 중단
        if (
          lastError.includes("SMTP") ||
          lastError.includes("시간 초과") ||
          emailProviderLabel() === "SMTP"
        ) {
          break;
        }
      }
    }

    if (
      !optIns.some((o) => o.email === normalized && o.matchAt === targetMatchAt)
    ) {
      optIns.push({
        email: normalized,
        accept: true,
        respondedAt: new Date().toISOString(),
        matchAt: targetMatchAt,
        mailedAt: mailed.includes(normalized)
          ? new Date().toISOString()
          : undefined,
      });
    }

    room.emailOptIns = optIns;

    room.messages.push({
      id: uuidv4(),
      authorName: "월담 AI",
      body:
        mailed.length === 0
          ? `📧 메일 발송에 실패했습니다. (${emailProviderLabel()}) ${lastError || "Render 메일 설정을 확인해 주세요."}`
          : failed.length === 0
            ? `📧 매칭 결과 메일을 구글 로그인 참가자 ${mailed.length}명에게 발송했습니다.`
            : `📧 메일 발송: 성공 ${mailed.length}명, 실패 ${failed.length}명.`,
      createdAt: new Date().toISOString(),
      system: true,
    });

    await saveRandomRoom(room);

    if (mailed.length === 0) {
      res.status(502).json({
        error:
          lastError ||
          "메일 발송에 실패했습니다. Gmail SMTP 대신 Resend(RESEND_API_KEY)를 권장합니다.",
        messages: normalizeRoomMessages(room),
      });
      return;
    }

    res.json({
      ok: true,
      accepted: true,
      mailed,
      failed,
      messages: normalizeRoomMessages(room),
    });
  } catch (e) {
    console.error(e);
    const raw = e instanceof Error ? e.message : "메일 요청 처리에 실패했습니다.";
    res.status(500).json({ error: raw });
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

    const { nickname, email, scores, rosterRowId, skipSchool } = req.body as {
      nickname?: string;
      email?: string;
      scores?: number[];
      rosterRowId?: string;
      skipSchool?: boolean;
    };

    let displayName = nickname?.trim() ?? "";
    let rosterFields: Record<string, string> | undefined;
    let rosterLabel: string | undefined;

    const globalRoster = await getGlobalRoster();

    if (globalRoster && !skipSchool) {
      if (!rosterRowId) {
        res.status(400).json({ error: "명단에서 학교명을 선택해 주세요." });
        return;
      }

      const cityOnly = parseChatCityOnlyId(rosterRowId);
      if (cityOnly) {
        rosterFields = { 도시명: cityOnly };
        rosterLabel = cityOnly;
        if (!displayName) {
          res.status(400).json({ error: "본인 이름을 입력해 주세요." });
          return;
        }
        if (!displayName.includes(cityOnly)) {
          displayName = `${displayName} (${cityOnly})`;
        }
      } else {
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

    const { authorName, body } = req.body as {
      authorName?: string;
      body?: string;
    };

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

    res.json({ ok: true, message, messages: normalizeRoomMessages(room) });
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
