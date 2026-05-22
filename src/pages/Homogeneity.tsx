import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { generateInsights } from "../lib/api";
import type { SessionInsights } from "../lib/api";
import { getHostCode } from "./wall/WallCreateSurvey";

export function Homogeneity() {
  const navigate = useNavigate();
  const [code, setCode] = useState(getHostCode() ?? "");
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setError("6자리 코드를 입력하세요.");
      return;
    }
    setLoading(true);
    setError("");
    setInsights(null);
    try {
      const { insights: data } = await generateInsights(trimmed);
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout
      title="동질성 지수"
      subtitle="설문 패턴 분석 · AI 한 줄 요약"
      onBack={() => navigate("/home")}
    >
      <form className="card" onSubmit={handleAnalyze}>
        <div className="field">
          <label className="label">세션 코드 (6자리)</label>
          <input
            className="input code-input"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="000000"
          />
        </div>
        <button type="submit" className="btn btn-accent" disabled={loading}>
          {loading ? "AI 분석 중… (30초~1분)" : "📊 분석하기"}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </form>

      {insights && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="homogeneity-score">
            <span className="homogeneity-score-label">동질성 지수</span>
            <span className="homogeneity-score-value">
              {insights.homogeneityIndex}
            </span>
            <span className="homogeneity-score-unit">/ 100</span>
          </div>
          <p className="homogeneity-hint">
            점수가 높을수록 전체 응답 패턴이 비슷합니다.
          </p>

          <h2 className="section-title">전체 요약</h2>
          <p className="insight-summary">{insights.overallSummary}</p>

          <h2 className="section-title">기준별 통계</h2>
          <div className="survey-table-wrap">
            <table className="survey-table">
              <thead>
                <tr>
                  <th>기준</th>
                  <th>평균</th>
                  <th>편차</th>
                  <th>최소</th>
                  <th>최대</th>
                </tr>
              </thead>
              <tbody>
                {insights.abilityStats.map((s) => (
                  <tr key={s.name}>
                    <td className="survey-nickname">{s.name}</td>
                    <td>{s.mean}</td>
                    <td>{s.std}</td>
                    <td>{s.min}</td>
                    <td>{s.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {insights.teamComments.length > 0 && (
            <>
              <h2 className="section-title">조별 한 줄 코멘트</h2>
              <ul className="team-comment-list">
                {insights.teamComments.map((t) => (
                  <li key={t.teamIndex}>
                    <span className="badge">{t.teamIndex}조</span>
                    {t.comment}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
