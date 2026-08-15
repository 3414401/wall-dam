import { FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SchoolCascadeSelect } from "../../components/SchoolCascadeSelect";
import { ScoreSlider } from "../../components/ScoreSlider";
import { Layout } from "../../components/Layout";
import { getSession, submitSurvey } from "../../lib/api";
import type { RosterRow } from "../../lib/api";

type Step = "code" | "survey";

export function WallJoin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [hasSchoolData, setHasSchoolData] = useState(false);
  const [schoolSkipped, setSchoolSkipped] = useState(false);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [nickname, setNickname] = useState("");
  const [scores, setScores] = useState([5, 5, 5, 5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const needsSchool = hasSchoolData && !schoolSkipped;

  const onAvailability = useCallback((hasData: boolean) => {
    setHasSchoolData(hasData);
  }, []);

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
      setScores(Array(session.abilities.length).fill(5));
      setSelectedRow(null);
      setStudentName("");
      setNickname("");
      setHasSchoolData(false);
      setSchoolSkipped(false);
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

    if (needsSchool && !selectedRow) {
      setError("도시명·시군구·학교명을 선택해 주세요.");
      return;
    }

    if (needsSchool && selectedRow && !studentName.trim()) {
      setError("본인 이름을 입력해 주세요. (같은 학교 여러 명 가능)");
      return;
    }

    if (!needsSchool && !nickname.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    const schoolLabel =
      selectedRow?.cells["학교명"]?.trim() || selectedRow?.label || "";
    const name = selectedRow
      ? `${studentName.trim()} (${schoolLabel})`
      : nickname;

    setLoading(true);
    try {
      await submitSurvey(
        code,
        name.trim(),
        scores,
        selectedRow?.id,
        schoolSkipped
      );
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

  const selectedSchool =
    selectedRow?.cells["학교명"]?.trim() || selectedRow?.label || "";

  return (
    <Layout
      title="설문 작성"
      subtitle={selectedSchool || `코드 ${code}`}
      onBack={() => setStep("code")}
    >
      <form className="card" onSubmit={handleSurveySubmit}>
        <SchoolCascadeSelect
          selectedRow={selectedRow}
          onSelect={(row) => {
            setSelectedRow(row);
            setError("");
          }}
          onAvailability={onAvailability}
          onSkipChange={(skipped) => {
            setSchoolSkipped(skipped);
            setError("");
            if (skipped) setSelectedRow(null);
          }}
        />

        {needsSchool && (
          <div className="field">
            <label className="label" htmlFor="student-name">
              본인 이름 (필수)
            </label>
            <input
              id="student-name"
              className="input"
              placeholder="예: 홍길동 — 같은 학교도 여러 명 가능"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
            <p className="api-banner-detail">
              같은 학교를 선택해도 됩니다. 이름으로 구분합니다.
            </p>
          </div>
        )}

        {!needsSchool && (
          <div className="field">
            <label className="label" htmlFor="nickname">
              닉네임 (본인 식별용)
            </label>
            <input
              id="nickname"
              className="input"
              placeholder="이름"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
        )}

        <p className="page-subtitle" style={{ margin: "16px 0" }}>
          아래 {abilities.length}개 기준을 0~10으로 평가해 주세요
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
