import { FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SchoolCascadeSelect } from "../../components/SchoolCascadeSelect";
import { ScoreSlider } from "../../components/ScoreSlider";
import { Layout } from "../../components/Layout";
import {
  getRandomRoom,
  submitRandomSurvey,
  type RosterRow,
} from "../../lib/api";
import { getUser } from "../../lib/auth";

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
  const user = getUser();
  const [abilities, setAbilities] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [participantCount, setParticipantCount] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(15);
  const [joinClosed, setJoinClosed] = useState(false);
  const [hasSchoolData, setHasSchoolData] = useState(false);
  const [schoolSkipped, setSchoolSkipped] = useState(false);
  const [selectedRow, setSelectedRow] = useState<RosterRow | null>(null);
  const [studentName, setStudentName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [scores, setScores] = useState([5, 5, 5]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(hasSurveyDone(code));

  const needsSchool = hasSchoolData && !schoolSkipped;

  const onAvailability = useCallback((hasData: boolean) => {
    setHasSchoolData(hasData);
  }, []);

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (needsSchool && !selectedRow) {
      setError("도시명을 선택해 주세요. (대전·대구는 시군구·학교명까지)");
      return;
    }

    if (needsSchool && selectedRow && !studentName.trim()) {
      setError("본인 이름을 입력해 주세요. (같은 학교 여러 명 가능)");
      return;
    }

    if (!needsSchool && !nickname.trim()) {
      setError("이름(닉네임)을 입력해 주세요.");
      return;
    }

    if (!email.trim()) {
      setError("이메일을 입력해 주세요.");
      return;
    }

    const schoolLabel =
      selectedRow?.cells["학교명"]?.trim() ||
      selectedRow?.cells["도시명"]?.trim() ||
      selectedRow?.label ||
      "";
    const name = selectedRow
      ? `${studentName.trim()} (${schoolLabel})`
      : nickname.trim();

    setSubmitting(true);
    try {
      const result = await submitRandomSurvey(
        code,
        name,
        email.trim(),
        scores,
        selectedRow?.id,
        schoolSkipped
      );
      setParticipantCount(result.total);
      setJoinClosed(result.joinClosed);
      markSurveyDone(code);
      setDone(true);
      navigate(`/random/chat/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출 실패");
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
              ? ` · ${maxParticipants}명이 모여 AI가 선정 이메일을 채팅방에 안내했습니다.`
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
        <SchoolCascadeSelect
          regionMode="chat"
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
          </div>
        )}

        {!needsSchool && (
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
