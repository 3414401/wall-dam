import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ScoreSlider } from "../../components/ScoreSlider";
import { Layout } from "../../components/Layout";
import {
  getRandomRoom,
  getRosterInfo,
  searchRandomRosterRows,
  submitRandomSurvey,
  type RosterRow,
} from "../../lib/api";

const SURVEY_DONE_KEY = "random_survey_done_rooms";

function loadSurveyDone(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(SURVEY_DONE_KEY) ?? "{}") as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

function markSurveyDone(roomCode: string) {
  const all = loadSurveyDone();
  all[roomCode] = true;
  sessionStorage.setItem(SURVEY_DONE_KEY, JSON.stringify(all));
}

function hasSurveyDone(roomCode: string): boolean {
  return !!loadSurveyDone()[roomCode];
}

export function RandomJoinPrepare() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const [abilities, setAbilities] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [joinClosed, setJoinClosed] = useState(false);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [rosterChecked, setRosterChecked] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<RosterRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [scores, setScores] = useState([5, 5, 5]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(hasSurveyDone(code));

  const needsSchoolPick = rosterChecked && rosterTotal > 0;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getRandomRoom(code);
        if (cancelled) return;
        setAbilities(data.abilities);
        setSubject(data.room.subject);
        setParticipantCount(data.room.participantCount);
        setMaxParticipants(data.room.maxParticipants);
        setJoinClosed(data.room.joinClosed);
        setScores(Array(data.abilities.length).fill(5));

        // 이미 이 세션에서 설문을 냈거나 모집이 마감된 경우 채팅으로 바로 입장
        if (hasSurveyDone(code) || data.room.joinClosed) {
          navigate(`/random/chat/${code}`, { replace: true });
          return;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "방 로드 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  useEffect(() => {
    if (loading || !code || done || joinClosed) return;

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
        const r = await searchRandomRosterRows(code, searchQ);
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
  }, [loading, code, searchQ, done, joinClosed]);

  async function handleSubmit(e: FormEvent) {
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

    if (!needsSchoolPick && !nickname.trim()) {
      setError("이름(닉네임)을 입력해 주세요.");
      return;
    }

    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    const name = selectedRow
      ? studentName.trim()
      : nickname.trim();

    setSubmitting(true);
    try {
      const result = await submitRandomSurvey(
        code,
        name,
        email.trim(),
        scores,
        selectedRow?.id
      );
      setParticipantCount(result.total);
      setJoinClosed(result.joinClosed);
      markSurveyDone(code);
      setDone(true);
      navigate(`/random/chat/${code}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("명단") || msg.includes("학교")) {
        setRosterTotal((n) => Math.max(n, 1));
        setRosterChecked(true);
        setSearchQ("");
      }
      setError(msg || "제출 실패");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Layout title="입장하기" subtitle="설문 불러오는 중..." onBack={() => navigate("/random/rooms")}>
        <p className="api-banner-detail">잠시만 기다려 주세요...</p>
      </Layout>
    );
  }

  if (done) {
    return (
      <Layout title="제출 완료" subtitle="설문이 저장되었습니다" onBack={() => navigate("/random/rooms")}>
        <div className="card placeholder-box">
          <div className="emoji">✅</div>
          <p>
            감사합니다! 설문 정보는 다른 사용자에게 보이지 않으며, AI만
            분석합니다.
          </p>
          <p className="api-banner-detail">
            현재 참여 {participantCount}/{maxParticipants}명
            {joinClosed
              ? " · 5명이 모여 AI가 선정 이메일을 채팅방에 안내했습니다."
              : ""}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          style={{ marginTop: 16 }}
          onClick={() => navigate(`/random/chat/${code}`)}
        >
          채팅방 입장
        </button>
      </Layout>
    );
  }

  return (
    <Layout
      title="입장하기 · 설문"
      subtitle={`${subject} · ${participantCount}/${maxParticipants}명`}
      onBack={() => navigate("/random/rooms")}
    >
      <div className="survey-guide-box">
        <p>
          채팅방에 들어가기 전에 설문을 작성해 주세요. 입력하신 정보는 다른
          사용자에게 공개되지 않습니다.
        </p>
      </div>

      <form className="card" onSubmit={handleSubmit}>
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
              {!listLoading && searchResults.length === 0 && rosterTotal > 0 && (
                <p className="error-msg" style={{ marginBottom: 12 }}>
                  검색 결과가 없습니다.
                </p>
              )}
              {!listLoading && rosterTotal === 0 && rosterChecked && (
                <p className="api-banner-detail">
                  명단이 없으면 아래 이름·닉네임으로 참여할 수 있습니다.
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
          </div>
        )}

        {rosterChecked && !needsSchoolPick && (
          <div className="field">
            <label className="label" htmlFor="prep-nickname">
              이름 (닉네임)
            </label>
            <input
              id="prep-nickname"
              className="input"
              placeholder="예: 홍길동"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="prep-email">
            이메일 (필수)
          </label>
          <input
            id="prep-email"
            className="input"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="api-banner-detail">
            AI 선정 시 이 이메일이 채팅방에 안내될 수 있습니다.
          </p>
        </div>

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
        <button type="submit" className="btn btn-accent" disabled={submitting}>
          {submitting ? "저장 중..." : "설문 제출 후 입장 ⭐"}
        </button>
      </form>
    </Layout>
  );
}
