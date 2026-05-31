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

export function RandomRoomList() {
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
      title="방 목록"
      subtitle="만들어진 랜덤 채팅방"
      onBack={() => navigate("/random")}
    >
      <ApiConnectionBanner />
      {loading && <p className="api-banner-detail">불러오는 중...</p>}
      {error && <p className="error-msg">{error}</p>}

      {!loading && rooms.length === 0 && (
        <div className="card placeholder-box">
          <div className="emoji">📭</div>
          <p>아직 만들어진 방이 없습니다.</p>
        </div>
      )}

      <div className="room-list">
        {rooms.map((room) => (
          <div className="card room-list-item" key={room.code}>
            <div className="room-list-head">
              <span className="room-subject-badge">{room.subject}</span>
              <span className="room-meta">{formatDate(room.createdAt)}</span>
            </div>
            <p className="room-list-title">
              {room.criterion3} · {room.criterion4}
            </p>
            <p className="api-banner-detail">
              참여 {room.participantCount}/{room.maxParticipants}
              {room.joinClosed ? " · 마감" : " · 모집 중"}
            </p>
            {room.selectedEmail && (
              <p className="success-msg" style={{ fontSize: "0.85rem" }}>
                선정 이메일: {room.selectedEmail}
              </p>
            )}
            <div className="room-list-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={room.joinClosed}
                onClick={() => navigate(`/random/prepare/${room.code}`)}
              >
                입장준비
              </button>
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={() => navigate(`/random/chat/${room.code}`)}
              >
                입장하기
              </button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
