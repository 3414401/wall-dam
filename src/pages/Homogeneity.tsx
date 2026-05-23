import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SurveyResultsTable } from "../components/SurveyResultsTable";
import { generateInsights } from "../lib/api";
import type { SessionData, SessionInsights } from "../lib/api";
import { downloadSessionExcel } from "../lib/surveyExport";
import { getHostCode } from "./wall/WallCreateSurvey";

export function Homogeneity() {
  const navigate = useNavigate();
  const [code, setCode] = useState(getHostCode() ?? "");
  const [session, setSession] = useState<SessionData | null>(null);
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
    setSession(null);
    try {
      const { insights: data, session: loaded } = await generateInsights(trimmed);
      setInsights(data);
      setSession(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout
      title="우리 조 AI 요약"
      subtitle="설문 표 · 다운로드 · AI 요약"
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
          {loading ? "AI 분석 중… (30초~1분)" : "📊 우리 조 AI 요약"}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </form>

      {session && insights && (
        <>
          <div className="card" style={{ marginTop: 16 }}>
            <SurveyResultsTable session={session} showExport={false} />
            {session.surveys.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => downloadSessionExcel(session)}
              >
                📥 설문 결과 엑셀(CSV) 다운로드
              </button>
            )}
          </div>

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

            {session.teamPurpose && (
              <>
                <h2 className="section-title">조를 짜는 목적</h2>
                <p className="insight-summary">{session.teamPurpose}</p>
              </>
            )}

            <h2 className="section-title">AI 전체 요약</h2>
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
        </>
      )}
    </Layout>
  );
}
