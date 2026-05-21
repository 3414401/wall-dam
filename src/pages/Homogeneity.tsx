import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

const PLACEHOLDER_ITEMS = [
  "팀 내 성향 유사도",
  "가치관 일치도",
  "협업 스타일 매칭",
  "의사소통 패턴 분석",
  "종합 동질성 지수",
];

export function Homogeneity() {
  const navigate = useNavigate();

  return (
    <Layout
      title="동질성 지수"
      subtitle="추후 기능이 추가됩니다"
      onBack={() => navigate("/home")}
    >
      <div className="card placeholder-box">
        <div className="emoji">📊</div>
        <p>아래 항목들이 곧 제공될 예정입니다.</p>
      </div>
      <ul className="card" style={{ marginTop: 16, listStyle: "none", padding: 16 }}>
        {PLACEHOLDER_ITEMS.map((item, i) => (
          <li
            key={item}
            style={{
              padding: "12px 0",
              borderBottom:
                i < PLACEHOLDER_ITEMS.length - 1
                  ? "1px solid rgba(255,255,255,0.15)"
                  : "none",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span className="badge">준비중</span>
            {item}
          </li>
        ))}
      </ul>
    </Layout>
  );
}
