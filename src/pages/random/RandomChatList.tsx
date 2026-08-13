import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiConnectionBanner } from "../../components/ApiConnectionBanner";
import { Layout } from "../../components/Layout";
import { listRandomRooms, type RandomRoomPublic } from "../../lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RandomChatList() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RandomRoomPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { rooms: list } = await listRandomRooms();
        if (!cancelled) setRooms(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "목록 로드 실패");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout
      title="채팅하기"
      subtitle="방을 선택하고 설문 후 대화"
      onBack={() => navigate("/random")}
    >
      <ApiConnectionBanner />
      <div className="survey-guide-box">
        <p>각 방은 게시글처럼 보이지만, 입장 후에는 채팅 UI로 대화합니다.</p>
      </div>

      {loading && <p className="api-banner-detail">불러오는 중...</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && rooms.length === 0 && (
        <div className="card placeholder-box">
          <div className="emoji">💬</div>
          <p>채팅할 방이 없습니다. 먼저 방을 만들어 주세요.</p>
        </div>
      )}

      <div className="chat-post-list">
        {rooms.map((room) => (
          <button
            type="button"
            key={room.code}
            className="card chat-post-card"
            onClick={() => navigate(`/random/prepare/${room.code}`)}
          >
            <div className="chat-post-head">
              <span className="room-subject-badge">{room.subject}</span>
              <span className="room-meta">{formatDate(room.createdAt)}</span>
            </div>
            <h3 className="chat-post-title">
              {room.subject} 팀 프로젝트 · {room.criterion3}
            </h3>
            <p className="chat-post-desc">
              {room.criterion4} · 참여 {room.participantCount}/
              {room.maxParticipants}
              {room.joinClosed ? " · 매칭 완료" : ""}
            </p>
            {room.selectedEmail && (
              <p className="chat-post-hint">AI 선정: {room.selectedEmail}</p>
            )}
            <span className="chat-post-enter">설문 후 입장 →</span>
          </button>
        ))}
      </div>
    </Layout>
  );
}
