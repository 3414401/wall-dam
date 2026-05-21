import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiConnectionBanner } from "../../components/ApiConnectionBanner";
import { Layout } from "../../components/Layout";
import { createSession } from "../../lib/api";
import { getUser } from "../../lib/auth";

const HOST_CODE_KEY = "team_wall_host_code";

export function getHostCode(): string | null {
  return sessionStorage.getItem(HOST_CODE_KEY);
}

export function setHostCode(code: string) {
  sessionStorage.setItem(HOST_CODE_KEY, code);
}

export function WallCreateSurvey() {
  const navigate = useNavigate();
  const user = getUser();
  const [abilities, setAbilities] = useState(["", "", "", "", ""]);
  const [code, setCode] = useState<string | null>(getHostCode());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateAbility(i: number, value: string) {
    const next = [...abilities];
    next[i] = value;
    setAbilities(next);
  }

  async function handleDeploy() {
    setError("");
    setLoading(true);
    try {
      const { code: newCode } = await createSession(
        abilities,
        user?.username ?? "host"
      );
      setCode(newCode);
      setHostCode(newCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "코드 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (code) navigator.clipboard.writeText(code);
  }

  return (
    <Layout
      title="설문조사 설정"
      subtitle="5가지 능력치 이름을 입력하세요"
      onBack={() => navigate("/wall/create")}
    >
      <ApiConnectionBanner />
      <div className="card">
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="field" key={i}>
            <label className="label" htmlFor={`ability-${i}`}>
              능력치 {i + 1}
            </label>
            <input
              id={`ability-${i}`}
              className="input"
              placeholder={`예: 리더십, 협업, 창의력...`}
              value={abilities[i]}
              onChange={(e) => updateAbility(i, e.target.value)}
              disabled={!!code}
            />
          </div>
        ))}

        {code ? (
          <>
            <p style={{ textAlign: "center", margin: 0 }}>입장 코드 (6자리)</p>
            <div className="code-display">{code}</div>
            <button type="button" className="btn btn-secondary" onClick={copyCode}>
              📋 코드 복사
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
