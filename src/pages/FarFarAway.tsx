import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { getWalldamPoints, type WalldamPointsPayload } from "../lib/api";
import { getUser } from "../lib/auth";
import {
  EMPTY_WALLDAM_POINTS,
  WALLDAM_REGION_META,
  type WalldamPointKey,
  walldamRegionBackground,
} from "../lib/walldamPoints";

const POINT_LIST: { key: WalldamPointKey; label: string }[] = [
  { key: "total", label: "월담 종합 포인트" },
  { key: "seoulGyeonggi", label: "서울/경기 포인트" },
  { key: "busanUlsanGyeongnam", label: "부산/울산/경남 포인트" },
  { key: "daeguGyeongbuk", label: "대구/경북 포인트" },
  { key: "gwangjuJeonnam", label: "광주/전남 포인트" },
  { key: "daejeonChungcheong", label: "대전/충남/충북 포인트" },
  { key: "gangwon", label: "강원 포인트" },
  { key: "jeonbuk", label: "전북 포인트" },
  { key: "jeju", label: "제주 포인트" },
];

export function FarFarAway() {
  const navigate = useNavigate();
  const user = getUser();
  const isGoogle = user?.provider === "google" && !!user.email?.trim();
  const [points, setPoints] = useState<WalldamPointsPayload>(EMPTY_WALLDAM_POINTS);
  const [loading, setLoading] = useState(isGoogle);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isGoogle || !user?.email) {
      setPoints(EMPTY_WALLDAM_POINTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await getWalldamPoints(user.email!);
        if (!cancelled) setPoints(data.points);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "포인트 불러오기 실패");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isGoogle, user?.email]);

  function scoreText(key: WalldamPointKey) {
    if (loading) return "…";
    return `${points[key] ?? 0}점`;
  }

  return (
    <Layout
      title="멀리 저 멀리"
      subtitle="지역사랑 상품권으로 교류 학습을 시작해요"
      onBack={() => navigate("/home")}
    >
      <p className="walldam-fill-hint">
        각 지역의 이용자와 교류할수록 색깔이 채워져요!
      </p>

      <div className="walldam-total-points" aria-live="polite">
        <p className="walldam-total-label">월담 종합 포인트</p>
        <p className="walldam-total-value">
          {loading ? "…" : points.total}
          <span className="walldam-total-unit">점</span>
        </p>
        {!isGoogle && (
          <p className="walldam-total-hint">
            구글 계정으로 로그인하면 채팅방에서 포인트를 적립할 수 있습니다.
          </p>
        )}
        {error && <p className="error-msg">{error}</p>}
      </div>

      <div className="far-phone" aria-label="지역 선택 지도">
        <div className="far-phone-speaker" aria-hidden />
        <div className="far-map">
          {WALLDAM_REGION_META.map((region) => {
            const score = points[region.key] ?? 0;
            return (
              <button
                key={region.mapId}
                type="button"
                className={`far-region far-region--${region.mapId}`}
                style={{ background: walldamRegionBackground(score) }}
                aria-label={`${region.pointLabel} ${score}점`}
                title={`${region.pointLabel}: ${score}점`}
              >
                {region.label.split("\n").map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </button>
            );
          })}
        </div>
        <div className="far-phone-home" aria-hidden />
      </div>

      <div className="walldam-points-panel" aria-label="월담 포인트 현황">
        <ul className="walldam-points-list">
          {POINT_LIST.map((item) => (
            <li key={item.key} className="walldam-points-row">
              <span className="walldam-points-name">{item.label}</span>
              <span className="walldam-points-score">{scoreText(item.key)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
}
