import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";

export function RandomHome() {
  const navigate = useNavigate();

  return (
    <Layout
      title="랜덤 팀 프로젝트"
      subtitle="랜덤 매칭 · 채팅 · 입장 코드"
      onBack={() => navigate("/home")}
    >
      <div className="btn-stack">
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/random/rooms")}
        >
          📋 방 목록
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => navigate("/random/create")}
        >
          ➕ 방 만들기
        </button>
      </div>
    </Layout>
  );
}
