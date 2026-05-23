import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

export function SchoolHomogeneity() {
  const navigate = useNavigate();

  return (
    <Layout
      title="학교별 동질성 지수 계산하기"
      subtitle="추후 설계 예정"
      onBack={() => navigate("/home")}
    >
      <div className="card placeholder-box">
        <div className="emoji">🏫📊</div>
        <p>
          학교별 동질성 지수를 계산하는 기능은
          <br />
          곧 추가됩니다.
        </p>
      </div>
    </Layout>
  );
}
