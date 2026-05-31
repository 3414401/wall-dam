import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiConnectionBanner } from "../../components/ApiConnectionBanner";
import { Layout } from "../../components/Layout";
import { createSession } from "../../lib/api";
import { getUser } from "../../lib/auth";

const HOST_CODE_KEY = "team_wall_host_code";
const HOST_INSIGHTS_CODE_KEY = "team_wall_insights_code";

export function getHostCode(): string | null {
  return sessionStorage.getItem(HOST_CODE_KEY);
}

export function setHostCode(code: string) {
  sessionStorage.setItem(HOST_CODE_KEY, code);
}

export function getHostInsightsCode(): string | null {
  return sessionStorage.getItem(HOST_INSIGHTS_CODE_KEY);
}

export function setHostInsightsCode(code: string) {
  sessionStorage.setItem(HOST_INSIGHTS_CODE_KEY, code);
}

export function WallCreateSurvey() {
  const navigate = useNavigate();
  const user = getUser();
  const [teamPurpose, setTeamPurpose] = useState("");
  const [abilities, setAbilities] = useState(["", "", "", ""]);
  const [code, setCode] = useState<string | null>(getHostCode());
  const [insightsCode, setInsightsCode] = useState<string | null>(
    getHostInsightsCode()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateAbility(i: number, value: string) {
    const next = [...abilities];
    next[i] = value;
    setAbilities(next);
  }

  async function handleDeploy() {
    setError("");
    if (!teamPurpose.trim()) {
      setError("조를 짜는 목적을 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const result = await createSession(
        abilities,
        user?.username ?? "host",
        teamPurpose.trim()
      );
      setCode(result.code);
      setInsightsCode(result.insightsCode);
      setHostCode(result.code);
      setHostInsightsCode(result.insightsCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "코드 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <Layout
      title="1단계: 설문 조사 만들기"
      subtitle="조 목적 · 기준 4개 · 코드 배포"
      onBack={() => navigate("/wall/create")}
    >
      <ApiConnectionBanner />
      <div className="survey-guide-box">
        <p>
          조를 짜는 목적과 기준 4개를 입력하세요. 학생들은 0~10점으로 응답하고,
          AI가 목적과 기준에 맞게 조를 배치합니다.
        </p>
      </div>

      <div className="card">
        <div className="field">
          <label className="label" htmlFor="team-purpose">
            조를 짜는 목적
          </label>
          <input
            id="team-purpose"
            className="input"
            placeholder="예: 다문화 교육, 친목, 공부..."
            value={teamPurpose}
            onChange={(e) => setTeamPurpose(e.target.value)}
            disabled={!!code}
          />
        </div>

        {[0, 1, 2, 3].map((i) => (
          <div className="field" key={i}>
            <label className="label" htmlFor={`ability-${i}`}>
              기준 {i + 1}
            </label>
            <input
              id={`ability-${i}`}
              className="input"
              placeholder="예: 지난 수업 이해도, 외향성, 통학 거리..."
              value={abilities[i]}
              onChange={(e) => updateAbility(i, e.target.value)}
              disabled={!!code}
            />
          </div>
        ))}

        {code ? (
          <>
            <p style={{ textAlign: "center", margin: "8px 0 0" }}>
              입장 코드 (6자리)
            </p>
            <div className="code-display">{code}</div>
            <p className="api-banner-detail" style={{ textAlign: "center" }}>
              학생/조원들에게 배포하는 코드입니다.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyText(code)}
            >
              📋 입장 코드 복사
            </button>

            <p style={{ textAlign: "center", margin: "16px 0 0" }}>
              AI 요약 코드 (6자리)
            </p>
            <div className="code-display">{insightsCode}</div>
            <p className="api-banner-detail" style={{ textAlign: "center" }}>
              교사(조장)만 볼 수 있게 비밀로 하는 코드입니다!
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => insightsCode && copyText(insightsCode)}
            >
              📋 AI 요약 코드 복사
            </button>

            <p className="success-msg">GitHub/로컬 서버에 저장되었습니다.</p>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleDeploy}
            disabled={loading}
          >
            {loading ? "생성 중..." : "🚀 코드 배포"}
          </button>
        )}
        {error && <p className="error-msg">{error}</p>}
      </div>
    </Layout>
  );
}
