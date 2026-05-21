import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";
import { getSession } from "../../lib/api";
import type { SessionData } from "../../lib/api";

export function WallResults() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setError("6자리 코드를 입력하세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { session: s } = await getSession(trimmed);
      setSession(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }

  const surveyMap = new Map(session?.surveys.map((s) => [s.id, s]) ?? []);

  return (
    <Layout
      title="조 결과보기"
      subtitle="코드로 설문·배치 결과 확인"
      onBack={() => navigate("/wall")}
    >
      <form className="card" onSubmit={handleSubmit}>
        <div className="field">
          <label className="label">입장 코드</label>
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
        <button type="submit" className="btn" disabled={loading}>
          {loading ? "조회 중..." : "결과 보기"}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </form>

      {session && (
        <div className="card" style={{ marginTop: 16 }}>
          <p>
            <span className="badge">코드 {session.code}</span>
          </p>
          <p style={{ fontSize: "0.9rem" }}>
            능력치: {session.abilities.join(" · ")}
          </p>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            설문 응답: {session.surveys.length}명
          </p>

          {!session.groups ? (
            <p className="placeholder-box" style={{ padding: "20px 0" }}>
              아직 조 배치 전입니다.
            </p>
          ) : (
            session.groups.map((g) => (
              <div key={g.teamIndex} className="team-card">
                <h3>{g.teamIndex}조</h3>
                <ul>
                  {g.memberIds.map((id) => {
                    const m = surveyMap.get(id);
                    return <li key={id}>{m?.nickname ?? id}</li>;
                  })}
                </ul>
                <p className="team-totals">
                  {session.abilities
                    .map((a, i) => `${a} ${g.totals[i]}`)
                    .join(" · ")}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
