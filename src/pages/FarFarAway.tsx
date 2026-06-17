import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";

const regions = [
  { id: "seoul-gyeonggi", label: "서울/\n경기" },
  { id: "gangwon", label: "강원" },
  { id: "chungcheong", label: "충남/충북" },
  { id: "daegu-gyeongbuk", label: "대구/경북" },
  { id: "jeonbuk", label: "전북" },
  { id: "gwangju-jeonnam", label: "광주/\n전남" },
  { id: "busan-ulsan-gyeongnam", label: "부산/울산/경남" },
  { id: "jeju", label: "제주" },
];

export function FarFarAway() {
  const navigate = useNavigate();

  return (
    <Layout
      title="멀리 저 멀리"
      subtitle="지역사랑 상품권으로 교류 학습을 시작해요"
      onBack={() => navigate("/home")}
    >
      <div className="far-phone" aria-label="지역 선택 지도">
        <div className="far-phone-speaker" aria-hidden />
        <div className="far-map">
          {regions.map((region) => (
            <button
              key={region.id}
              type="button"
              className={`far-region far-region--${region.id}`}
              aria-label={`${region.label.replace("\n", " ")} 지역`}
            >
              {region.label.split("\n").map((line) => (
                <span key={line}>{line}</span>
              ))}
            </button>
          ))}
        </div>
        <div className="far-phone-home" aria-hidden />
      </div>
    </Layout>
  );
}
