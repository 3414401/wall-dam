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

type Step = "code" | "pick" | "survey";

export function WallJoin() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [hasRoster, setHasRoster] = useState(false);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [abilities, setAbilities] = useState<string[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<RosterRow[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null);
  const [nickname, setNickname] = useState("");
  const [scores, setScores] = useState([5, 5, 5, 5, 5]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (step !== "pick" || !code) {
      setSearchResults([]);
      setListTotal(0);
      return;
    }
    setListLoading(true);
    const t = setTimeout(() => {
      void searchRosterRows(code, searchQ)
        .then((r) => {
          setSearchResults(r.results);
          setListTotal(r.total);
        })
        .catch(() => {
          setSearchResults([]);
          setListTotal(0);
        })
        .finally(() => setListLoading(false));
    }, searchQ.trim() ? 300 : 0);
    return () => clearTimeout(t);
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
      setScores([5, 5, 5, 5, 5]);
      let rosterRows = 0;
      try {
        const info = await getRosterInfo();
        rosterRows = info.rowCount;
      } catch {
        rosterRows = 0;
      }
      if (rosterRows === 0) {
        try {
          const probe = await searchRosterRows(trimmed, "");
          rosterRows = probe.total;
        } catch {
          rosterRows = 0;
        }
      }
      setHasRoster(rosterRows > 0);
      setRosterTotal(rosterRows);
      setStep(rosterRows > 0 ? "pick" : "survey");
      setSelectedRow(null);
      setSearchQ("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장 실패");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectRow(row: RosterRow) {
    setSelectedRow(row);
    setStep("survey");
    setError("");
  }

  async function handleSurveySubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const name = selectedRow?.label ?? nickname;
      if (!name.trim()) {
        setError("이름을 입력하거나 명단에서 선택해 주세요.");
        setLoading(false);
        return;
      }
      await submitSurvey(code, name.trim(), scores, selectedRow?.id);
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

  if (step === "pick") {
    return (
      <Layout
        title="본인 선택"
        subtitle={`명단 ${rosterTotal}명 중 찾기`}
        onBack={() => setStep("code")}
      >
        <div className="card">
          <div className="field">
            <label className="label" htmlFor="roster-search">
              학교명 선택 (A열)
            </label>
            <input
              id="roster-search"
              className="input"
              placeholder="학교명 검색 (비워두면 전체 목록)"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              autoFocus
            />
          </div>
          <p className="api-banner-detail">
            {listLoading
              ? "명단 불러오는 중..."
              : searchQ.trim()
                ? `검색 결과 ${searchResults.length}건 / 전체 ${listTotal}건`
                : `학교명 ${searchResults.length}건 (전체 ${listTotal}건)`}
          </p>
          {!listLoading && searchResults.length === 0 && (
            <p className="error-msg" style={{ marginBottom: 12 }}>
              {listTotal === 0
                ? "명단이 비어 있습니다. GitHub data/roster.xlsx 를 확인해 주세요."
                : "검색 결과가 없습니다. A열 학교명을 다시 확인해 주세요."}
            </p>
          )}
          <ul className="roster-pick-list">
            {searchResults.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="roster-pick-item"
                  onClick={() => handleSelectRow(row)}
                >
                  {row.label}
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="error-msg">{error}</p>}
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="설문 작성"
      subtitle={selectedRow ? selectedRow.label : `코드 ${code}`}
      onBack={() => setStep(hasRoster ? "pick" : "code")}
    >
      <form className="card" onSubmit={handleSurveySubmit}>
        {selectedRow && (
          <div className="roster-detail-box">
            <h2 className="section-title">엑셀 명단 정보</h2>
            <ul className="roster-detail-list">
              {Object.entries(selectedRow.cells).map(([key, val]) => (
                <li key={key}>
                  <span className="roster-detail-key">{key}</span>
                  <span>{val || "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!hasRoster && (
          <div className="field">
            <label className="label" htmlFor="nickname">
              닉네임
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
          아래 5개 기준을 0~10으로 평가해 주세요 (AI 조 배치에 반영)
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
