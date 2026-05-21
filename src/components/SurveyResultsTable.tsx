import type { SessionData } from "../lib/api";
import { downloadSessionExcel, formatSubmittedAt } from "../lib/surveyExport";

interface SurveyResultsTableProps {
  session: SessionData;
  showExport?: boolean;
}

export function SurveyResultsTable({
  session,
  showExport = true,
}: SurveyResultsTableProps) {
  return (
    <div className="survey-results-block">
      <div className="survey-results-header">
        <h2 className="section-title">설문조사 결과</h2>
        {showExport && session.surveys.length > 0 && (
          <button
            type="button"
            className="btn-export"
            onClick={() => downloadSessionExcel(session)}
          >
            📥 엑셀보내기
          </button>
        )}
      </div>
      {session.surveys.length === 0 ? (
        <p className="survey-empty">아직 제출된 설문이 없습니다.</p>
      ) : (
        <div className="survey-table-wrap">
          <table className="survey-table">
            <thead>
              <tr>
                <th>닉네임</th>
                <th>제출시간</th>
                {session.abilities.map((a) => (
                  <th key={a}>{a}</th>
                ))}
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {session.surveys.map((s) => (
                <tr key={s.id}>
                  <td className="survey-nickname">{s.nickname}</td>
                  <td className="survey-time">
                    {formatSubmittedAt(s.submittedAt)}
                  </td>
                  {s.scores.map((score, i) => (
                    <td key={i}>{score}</td>
                  ))}
                  <td className="survey-sum">
                    {s.scores.reduce((a, b) => a + b, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
