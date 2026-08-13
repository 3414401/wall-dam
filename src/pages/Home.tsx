import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { getUser, logout } from "../lib/auth";

export function Home() {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <Layout
      title={`안녕하세요, ${user?.username ?? "게스트"}님`}
      subtitle={
        user?.provider === "google"
          ? "Google 계정으로 로그인됨 · 원하는 메뉴를 선택하세요"
          : "원하는 메뉴를 선택하세요"
      }
      onBack={() => {
        logout();
        navigate("/");
      }}
    >
      <div className="btn-stack">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigate("/wall")}
        >
          1️⃣ 조짜기🧱
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => navigate("/homogeneity")}
        >
          2️⃣ 우리 조 AI 요약📊
        </button>
        <button
          type="button"
          className="btn btn-accent"
          onClick={() => navigate("/random")}
        >
          🎲 랜덤 학습 채팅
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
