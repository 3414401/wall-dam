import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiConnectionBanner } from "../../components/ApiConnectionBanner";
import { Layout } from "../../components/Layout";
import { createRandomRoom, RANDOM_CRITERION1, RANDOM_SUBJECTS } from "../../lib/api";
import { getUser } from "../../lib/auth";

const HOST_ROOM_KEY = "random_project_host_room";

export function getHostRandomRoom(): { code: string } | null {
  const raw = sessionStorage.getItem(HOST_ROOM_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { code: string };
  } catch {
    return null;
  }
}

export function setHostRandomRoom(code: string) {
  sessionStorage.setItem(HOST_ROOM_KEY, JSON.stringify({ code }));
}

export function RandomCreateRoom() {
  const navigate = useNavigate();
  const user = getUser();
  const [subject, setSubject] = useState<(typeof RANDOM_SUBJECTS)[number]>(
    "기획/아이디어"
  );
  const [criterion3, setCriterion3] = useState("");
  const [criterion4, setCriterion4] = useState("");
  const [created, setCreated] = useState<{ code: string } | null>(
    getHostRandomRoom()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    setError("");
    if (!criterion3.trim() || !criterion4.trim()) {
      setError("기준 3, 기준 4를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { code } = await createRandomRoom(
        subject,
        criterion3.trim(),
        criterion4.trim(),
        user?.username ?? "host"
      );
      setCreated({ code });
      setHostRandomRoom(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 생성 실패");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <Layout
      title="방 만들기"
      subtitle="주제 · 기준 설정"
      onBack={() => navigate("/random")}
    >
      <ApiConnectionBanner />
      <div className="survey-guide-box">
        <p>
          방 주제와 기준을 설정하세요. 참가자 5명이 설문을 완료하면 AI가 가장
          이질성이 높은 사람을 선정합니다.
        </p>
      </div>

      <div className="card">
        <div className="field">
          <label className="label" htmlFor="room-subject">
            방의 주제
          </label>
          <select
            id="room-subject"
            className="input"
            value={subject}
            onChange={(e) =>
              setSubject(e.target.value as (typeof RANDOM_SUBJECTS)[number])
            }
            disabled={!!created}
          >
            {RANDOM_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <p className="learning-style-prompt">어떤 학습스타일이 떠오르나요?</p>

        <div className="field">
          <label className="label">기준 1</label>
          <input className="input" value={RANDOM_CRITERION1} disabled />
        </div>

        <div className="field">
          <label className="label" htmlFor="criterion-3">
            기준 3
          </label>
          <input
            id="criterion-3"
            className="input"
            placeholder="예: 엄밀한 풀이, 진지함, mbti T/F, 지역 등"
            value={criterion3}
            onChange={(e) => setCriterion3(e.target.value)}
            disabled={!!created}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="criterion-4">
            기준 4
          </label>
          <input
            id="criterion-4"
            className="input"
            placeholder="예: 엄밀한 풀이, 진지함, mbti T/F, 지역 등"
            value={criterion4}
            onChange={(e) => setCriterion4(e.target.value)}
            disabled={!!created}
          />
        </div>

        {created ? (
          <>
            <p style={{ textAlign: "center", margin: "8px 0 0" }}>방 코드</p>
            <div className="code-display">{created.code}</div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyText(created.code)}
            >
              📋 방 코드 복사
            </button>
            <p className="success-msg">방 목록에 등록되었습니다.</p>
            <button
              type="button"
              className="btn"
              onClick={() => navigate("/random/rooms")}
            >
              방 목록 보기
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-accent"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? "생성 중..." : "🚀 방 만들기"}
          </button>
        )}
        {error && <p className="error-msg">{error}</p>}
      </div>
    </Layout>
  );
}
