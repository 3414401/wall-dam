import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";

export function WallHome() {
  const navigate = useNavigate();

  return (
    <Layout
      title="담을 넘는 조짜기"
      subtitle="5가지 능력치 · 설문 기반 밸런스 조"
      onBack={() => navigate("/home")}
    >
      <div className="btn-stack">
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => navigate("/wall/create")}
        >
          ➕ 조 만들기
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/wall/join")}
        >
          🔑 조 참여하기
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/wall/results")}
        >
          📋 조 결과보기
        </button>
      </div>
    </Layout>
  );
}
