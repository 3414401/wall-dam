import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScoreSlider } from "../../components/ScoreSlider";
import { Layout } from "../../components/Layout";
import { getSession, submitSurvey } from "../../lib/api";

export function WallJoin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"code" | "survey">("code");
  const [code, setCode] = useState("");
  const [abilities, setAbilities] = useState<string[]>([]);
  const [nickname, setNickname] = useState("");
  const [scores, setScores] = useState([5, 5, 5, 5, 5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = code.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setError("6자리 숫자 코드를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { session } = await getSession(trimmed);
      setCode(trimmed);
      setAbilities(session.abilities);
      setScores([5, 5, 5, 5, 5]);
      setStep("survey");
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장 실패");
    } finally {
      setLoading(false);
    }
  }

  async function handleSurveySubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!nickname.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await submitSurvey(code, nickname, scores);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출 실패");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <Layout
        title="조 참여하기"
        subtitle="배포받은 6자리 코드 입력"
        onBack={() => navigate("/wall")}
      >
        <form className="card" onSubmit={handleCodeSubmit}>
          <div className="field">
            <label className="label" htmlFor="join-code">
              입장 코드
            </label>
            <input
              id="join-code"
              className="input code-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-accent" disabled={loading}>
            {loading ? "확인 중..." : "입장하기 ⭐"}
          </button>
        </form>
      </Layout>
    );
  }

  if (done) {
    return (
      <Layout title="제출 완료" subtitle="설문이 저장되었습니다">
        <div className="card placeholder-box">
          <div className="emoji">✅</div>
          <p>감사합니다! 조장이 조 배치 후 결과를 확인할 수 있습니다.</p>
        </div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 16 }}
          onClick={() => navigate("/wall")}
        >
          메인으로
        </button>
      </Layout>
    );
  }

  return (
    <Layout
      title="능력치 설문"
      subtitle={`코드 ${code}`}
      onBack={() => setStep("code")}
    >
      <form className="card" onSubmit={handleSurveySubmit}>
        <div className="field">
          <label className="label" htmlFor="nickname">
            닉네임 (본인 식별용)
          </label>
          <input
            id="nickname"
            className="input"
            placeholder="이름 또는 닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </div>
        <p className="page-subtitle" style={{ marginBottom: 16 }}>
          각 항목을 0~10으로 평가해 주세요
        </p>
        {abilities.map((name, i) => (
          <ScoreSlider
            key={name}
            label={name}
            value={scores[i]}
            onChange={(v) => {
              const next = [...scores];
              next[i] = v;
              setScores(next);
            }}
          />
        ))}
        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn btn-accent" disabled={loading}>
          {loading ? "저장 중..." : "설문 제출 ⭐"}
        </button>
      </form>
    </Layout>
  );
}
