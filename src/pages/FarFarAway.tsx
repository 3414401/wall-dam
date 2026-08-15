import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { getWalldamPoints, type WalldamPointsPayload } from "../lib/api";
import { getUser } from "../lib/auth";
import {
  EMPTY_WALLDAM_POINTS,
  WALLDAM_REGION_META,
  walldamRegionBackground,
} from "../lib/walldamPoints";

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

  return (
    <Layout
      title="멀리 저 멀리"
      subtitle="지역사랑 상품권으로 교류 학습을 시작해요"
      onBack={() => navigate("/home")}
    >
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
    </Layout>
  );
}
