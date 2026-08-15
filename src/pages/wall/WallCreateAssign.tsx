import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { SurveyResultsTable } from "../../components/SurveyResultsTable";
import { balanceSession, balanceSessionAi, getSession } from "../../lib/api";
import type { SessionData } from "../../lib/api";
import { getHostCode, setHostCode } from "./WallCreateSurvey";

const AUTO_BALANCE_LABEL = "자동 균형 배치";

function displayBalanceNote(session: SessionData): string | null {
  if (!session.aiBalanceNote) return null;
  if (session.balanceMethod === "ai") return session.aiBalanceNote;
  return AUTO_BALANCE_LABEL;
}

export function WallCreateAssign() {
  const navigate = useNavigate();
  const [code, setCode] = useState(getHostCode() ?? "");
  const [teamCount, setTeamCount] = useState(4);
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSessionByCode(c: string) {
    setLoading(true);
    setError("");
    try {
      const { session: s } = await getSession(c);
      setSession(s);
      setHostCode(c);
      if (s.teamCount) setTeamCount(s.teamCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 실패");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = getHostCode();
    if (saved && saved.length === 6) {
      void loadSessionByCode(saved);
    }
  }, []);

  async function handleLoad(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setError("6자리 코드를 입력하세요.");
      return;
    }
    await loadSessionByCode(trimmed);
  }

  async function handleBalance() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const { session: updated } = await balanceSession(session.code, teamCount);
      setSession(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "배치 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleBalanceAi() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const { session: updated, usedAi, teamExplanations } =
        await balanceSessionAi(session.code, teamCount);
      const explanations =
        teamExplanations ?? updated.aiTeamExplanations ?? null;
      setSession(
        usedAi
          ? {
              ...updated,
              aiTeamExplanations: explanations,
            }
          : {
              ...updated,
              balanceMethod: "greedy",
              aiBalanceNote: AUTO_BALANCE_LABEL,
              aiTeamExplanations: explanations,
            }
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 배치 실패");
    } finally {
      setLoading(false);
    }
  }

  const surveyMap = new Map(
    session?.surveys.map((s) => [s.id, s]) ?? []
  );

  return (
    <Layout
      title="2단계: 조 배치하기"
      subtitle="자동 균형 배치 · AI 조 배치"
      onBack={() => navigate("/wall/create")}
    >
      <form className="card" onSubmit={handleLoad}>
        <div className="field">
          <label className="label">세션 코드</label>
          <input
            className="input code-input"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={loading}>
          세션 불러오기
        </button>
      </form>

      {session && (
        <div className="card" style={{ marginTop: 16 }}>
          <p>
            <span className="badge">설문 {session.surveys.length}명</span>
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            능력치: {session.abilities.join(" · ")}
          </p>

          <SurveyResultsTable session={session} />

          <div className="field" style={{ marginTop: 16 }}>
            <label className="label">조 개수</label>
            <input
              type="number"
              className="input"
              min={2}
              max={Math.max(2, session.surveys.length)}
              value={teamCount}
              onChange={(e) => setTeamCount(Number(e.target.value))}
            />
          </div>

          <div className="btn-stack" style={{ marginTop: 8 }}>
            <div>
              <button
                type="button"
                className="btn btn-accent"
                onClick={handleBalanceAi}
                disabled={loading || session.surveys.length < 2}
              >
                {loading ? "AI 배치 중… (최대 1분)" : "🤖 AI 조 배치"}
              </button>
              <p
                className="api-banner-detail"
                style={{ marginTop: 8, marginBottom: 0, fontSize: "0.78rem" }}
              >
                아직은 서버 할당량이 작아, 일일 AI 한도를 초과할 경우 실행되지
                않을 수 있습니다. 더 나은 서버 구축을 위해 노력하겠습니다.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBalance}
              disabled={loading || session.surveys.length < 2}
            >
              ⚡ 빠른 자동 배치
            </button>
          </div>

          {displayBalanceNote(session) && (
            <div className="ai-explain-box" style={{ marginTop: 12 }}>
              {session.balanceMethod === "ai" ? (
                <>
                  <h2 className="section-title">🤖 AI 배치 설명</h2>
                  <p className="insight-summary">{displayBalanceNote(session)}</p>
                </>
              ) : (
                <p className="insight-summary">{displayBalanceNote(session)}</p>
              )}
            </div>
          )}

          {session.balanceMethod === "ai" &&
            session.aiTeamExplanations &&
            session.aiTeamExplanations.length > 0 && (
              <div className="ai-explain-box" style={{ marginTop: 12 }}>
                <h2 className="section-title">조별 배정 이유</h2>
                <ul className="team-comment-list">
                  {session.aiTeamExplanations.map((t) => (
                    <li key={t.teamIndex}>
                      <span className="badge">{t.teamIndex}조</span>
                      {t.comment}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {(session.aiTeamExplanations?.some((t) => t.recommendedActivity) ||
            session.insights?.teamComments?.some((t) => t.recommendedActivity)) && (
              <div className="ai-explain-box" style={{ marginTop: 12 }}>
                <h2 className="section-title">조별 추천 활동</h2>
                <ul className="team-comment-list">
                  {(
                    session.aiTeamExplanations?.some((t) => t.recommendedActivity)
                      ? session.aiTeamExplanations
                      : session.insights?.teamComments ?? []
                  )
                    .filter((t) => t.recommendedActivity)
                    .map((t) => (
                      <li key={`act-${t.teamIndex}`}>
                        <span className="badge">{t.teamIndex}조</span>
                        {t.recommendedActivity}
                      </li>
                    ))}
                </ul>
              </div>
            )}

          {session.groups && (
            <div style={{ marginTop: 20 }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.2rem",
                  margin: "0 0 12px",
                }}
              >
                배치 결과
              </h2>
              {session.groups.map((g) => (
                <div key={g.teamIndex} className="team-card">
                  <h3>{g.teamIndex}조</h3>
                  <ul>
                    {g.memberIds.map((id) => {
                      const m = surveyMap.get(id);
                      return (
                        <li key={id}>
                          {m?.nickname ?? id.slice(0, 6)}
                          {m && (
                            <span style={{ opacity: 0.7, fontSize: "0.85rem" }}>
                              {" "}
                              ({m.scores.join(", ")})
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="team-totals">
                    합계:{" "}
                    {session.abilities
                      .map((a, i) => `${a} ${g.totals[i]}`)
                      .join(" · ")}
                  </p>
                  {(() => {
                    const activity =
                      session.aiTeamExplanations?.find(
                        (t) => t.teamIndex === g.teamIndex
                      )?.recommendedActivity ||
                      session.insights?.teamComments?.find(
                        (t) => t.teamIndex === g.teamIndex
                      )?.recommendedActivity;
                    return activity ? (
                      <p className="team-recommended-activity">
                        추천활동: {activity}
                      </p>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="error-msg">{error}</p>}
    </Layout>
  );
}
