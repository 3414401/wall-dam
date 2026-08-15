import { useNavigate } from "react-router-dom";
import { Layout } from "../../components/Layout";

export function WallCreate() {
  const navigate = useNavigate();

  return (
    <Layout
      title="조 만들기"
      subtitle="설문 설정 후 코드를 배포하세요"
      onBack={() => navigate("/wall")}
    >
      <div className="btn-stack">
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/wall/create/survey")}
        >
          1단계: 설문 조사 만들기
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/wall/create/assign")}
        >
          2단계: 조 배치하기🤖
        </button>
      </div>
    </Layout>
  );
}
