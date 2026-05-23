import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScoreSlider } from "../../components/ScoreSlider";
import { Layout } from "../../components/Layout";
import {
  getRosterInfo,
  getSession,
  searchRosterRows,
  submitSurvey,
} from "../../lib/api";
import type { RosterRow } from "../../lib/api";

type Step = "code" | "survey";

export function WallJoin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterChecked, setRosterChecked] = useState(false);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<RosterRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [nickname, setNickname] = useState("");
  const [scores, setScores] = useState([5, 5, 5, 5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const needsSchoolPick = rosterChecked && rosterTotal > 0;

  useEffect(() => {
    if (step !== "survey" || !code) return;

    let cancelled = false;
    setListLoading(true);

    void (async () => {
      let total = 0;
      try {
        const info = await getRosterInfo();
        total = info.rowCount;
      } catch {
        /* roster/info 실패 시 search로 재시도 */
      }

      try {
        const r = await searchRosterRows(code, searchQ);
        if (cancelled) return;
        setSearchResults(r.results);
        setRosterTotal(Math.max(total, r.total));
      } catch {
        if (cancelled) return;
        setSearchResults([]);
        if (total > 0) setRosterTotal(total);
      } finally {
        if (!cancelled) {
          setRosterChecked(true);
          setListLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, code, searchQ]);

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
      setSearchQ("");
      setSearchResults([]);
      setRosterTotal(0);
      setRosterChecked(false);

      try {
        const info = await getRosterInfo();
        setRosterTotal(info.rowCount);
      } catch {
        try {
          const probe = await searchRosterRows(trimmed, "");
          setRosterTotal(probe.total);
        } catch {
          setRosterTotal(0);
        }
      }

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

    if (needsSchoolPick && !selectedRow) {
      setError("학교명을 목록에서 선택해 주세요.");
      return;
    }

    if (needsSchoolPick && selectedRow && !studentName.trim()) {
      setError("본인 이름을 입력해 주세요. (같은 학교 여러 명 가능)");
      return;
    }

    if (!needsSchoolPick && !selectedRow && !nickname.trim()) {
      setError("학교명을 선택하거나 닉네임을 입력해 주세요.");
      return;
    }

    const name = selectedRow
      ? `${studentName.trim()} (${selectedRow.label})`
      : nickname;

    setLoading(true);
    try {
      await submitSurvey(code, name.trim(), scores, selectedRow?.id);
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("명단에서")) {
        setRosterTotal((n) => Math.max(n, 1));
        setRosterChecked(true);
        setSearchQ("");
      }
      setError(msg || "제출 실패");
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
      title="설문 작성"
      subtitle={selectedRow ? selectedRow.label : `코드 ${code}`}
      onBack={() => setStep("code")}
    >
      <form className="card" onSubmit={handleSurveySubmit}>
        <div className="roster-pick-section">
            <h2 className="section-title">학교명 선택 (필수)</h2>
            <p className="api-banner-detail">
              roster.xlsx A열 목록에서 본인 학교를 선택하세요.
            </p>

            {selectedRow ? (
              <div className="roster-selected-box">
                <span className="roster-selected-label">선택됨</span>
                <strong>{selectedRow.label}</strong>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setSelectedRow(null)}
                >
                  다시 선택
                </button>
              </div>
            ) : (
              <>
                <div className="field">
                  <label className="label" htmlFor="roster-search">
                    학교명 검색
                  </label>
                  <input
                    id="roster-search"
                    className="input"
                    placeholder="비워두면 전체 목록"
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                  />
                </div>
                <p className="api-banner-detail">
                  {listLoading
                    ? "명단 불러오는 중..."
                    : searchQ.trim()
                      ? `검색 ${searchResults.length}건 / 전체 ${rosterTotal}건`
                      : `학교명 ${searchResults.length}건 (전체 ${rosterTotal}건)`}
                </p>
                {!listLoading && searchResults.length === 0 && (
                  <p className="error-msg" style={{ marginBottom: 12 }}>
                    {rosterTotal === 0
                      ? "명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
                      : "검색 결과가 없습니다."}
                  </p>
                )}
                <ul className="roster-pick-list">
                  {searchResults.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="roster-pick-item"
                        onClick={() => {
                          setSelectedRow(row);
                          setError("");
                        }}
                      >
                        {row.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

          </div>

        {needsSchoolPick && (
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

        {rosterChecked && !needsSchoolPick && (
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
