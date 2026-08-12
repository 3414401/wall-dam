import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { getUser, logout } from "../lib/auth";

export function Home() {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <Layout
      title={`안녕하세요, ${user?.username ?? "게스트"}님`}
      subtitle="원하는 메뉴를 선택하세요"
      onBack={() => {
        logout();
        navigate("/");
      }}
    >
      <div className="btn-stack">
        <button
          type="button"
          className="btn btn-soft-green"
          onClick={() => {
            window.location.href = "https://3414401.github.io/walldam_calculate/";
          }}
        >
          🏫 공공데이터로 동질성 지수 계산하기
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/homogeneity")}
        >
          📊 우리 조 AI 요약
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/wall")}
        >
          🧱 담을 넘는 조짜기
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => navigate("/random")}
        >
          🎲 랜덤 팀 프로젝트
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/far-far-away")}
        >
          🗺️ 멀리 저 멀리
        </button>
      </div>
    </Layout>
  );
}
