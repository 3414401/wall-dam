import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

export function RandomProject() {
  const navigate = useNavigate();

  return (
    <Layout
      title="랜덤 팀 프로젝트"
      subtitle="추후 랜덤 매칭·채팅 기능 예정"
      onBack={() => navigate("/home")}
    >
      <div className="card placeholder-box">
        <div className="emoji">🎲💬</div>
        <p>
          랜덤으로 팀원을 연결하고
          <br />
          프로젝트를 진행하는 기능이
          <br />
          곧 추가됩니다.
        </p>
      </div>
    </Layout>
  );
}
