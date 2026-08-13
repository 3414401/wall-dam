import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiConnectionBanner } from "../../components/ApiConnectionBanner";
import { Layout } from "../../components/Layout";
import { createRandomRoom, RANDOM_CRITERION1, RANDOM_SUBJECTS } from "../../lib/api";
import { getUser } from "../../lib/auth";

export function RandomCreateRoom() {
  const navigate = useNavigate();
  const user = getUser();
  const [subject, setSubject] = useState<(typeof RANDOM_SUBJECTS)[number]>(
    "기획/아이디어"
  );
  const [criterion3, setCriterion3] = useState("");
  const [criterion4, setCriterion4] = useState("");
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
      await createRandomRoom(
        subject,
        criterion3.trim(),
        criterion4.trim(),
        user?.username ?? "host"
      );
      navigate("/random/rooms");
    } catch (e) {
      setError(e instanceof Error ? e.message : "방 생성 실패");
    } finally {
      setLoading(false);
    }
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
          방 주제와 기준을 설정하세요. 만든 방은 방 목록에 바로 보이며, 참가자는
          코드를 받을 필요 없이 입장할 수 있습니다.
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
          />
        </div>

        <button
          type="button"
          className="btn btn-accent"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? "생성 중..." : "🚀 방 만들기"}
        </button>
        {error && <p className="error-msg">{error}</p>}
      </div>
    </Layout>
  );
}
