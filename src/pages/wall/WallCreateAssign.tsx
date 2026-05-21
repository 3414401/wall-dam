import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { SurveyResultsTable } from "../../components/SurveyResultsTable";
import { balanceSession, getSession } from "../../lib/api";
import type { SessionData } from "../../lib/api";
import { getHostCode, setHostCode } from "./WallCreateSurvey";

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

  const surveyMap = new Map(
    session?.surveys.map((s) => [s.id, s]) ?? []
  );

  return (
    <Layout
      title="조 배치하기"
      subtitle="5차원 능력치 합계 균형 배정"
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

          <button
            type="button"
            className="btn btn-accent"
            onClick={handleBalance}
            disabled={loading || session.surveys.length < 2}
            style={{ marginTop: 8 }}
          >
            {loading ? "배치 중..." : "⚡ 자동 조 배치"}
          </button>

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
