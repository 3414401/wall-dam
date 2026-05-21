import { useEffect, useState } from "react";
import { getApiBase } from "../lib/apiConfig";

type Status = "checking" | "ok" | "fail";

export function ApiConnectionBanner() {
  const [status, setStatus] = useState<Status>("checking");
  const [detail, setDetail] = useState("");
  const apiBase = getApiBase();

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!apiBase) {
        if (!cancelled) {
          setStatus("fail");
          setDetail(
            "API 주소가 비어 있습니다. config.json 또는 npm run dev를 확인하세요."
          );
        }
        return;
      }

      try {
        const res = await fetch(`${apiBase}/api/health`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; storage?: string };
        if (!cancelled) {
          if (res.ok && data.ok) {
            setStatus("ok");
            setDetail(
              data.storage === "github"
                ? "서버 연결됨 · GitHub 저장 준비 완료"
                : "서버 연결됨 · GitHub 토큰 미설정(Render 환경 변수 확인)"
            );
          } else {
            setStatus("fail");
            setDetail(`서버 응답 이상 (${res.status})`);
          }
        }
      } catch {
        if (!cancelled) {
          setStatus("fail");
          setDetail(
            "서버에 연결할 수 없습니다. Render가 Live인지, 1분 후 다시 시도하세요."
          );
        }
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return (
    <div
      className={`api-banner api-banner--${status}`}
      role="status"
    >
      <p className="api-banner-title">
        {status === "checking" && "서버 연결 확인 중…"}
        {status === "ok" && "✓ API 연결 정상"}
        {status === "fail" && "✗ API 연결 문제"}
      </p>
      <p className="api-banner-url">
        연결 주소: {apiBase || "(없음)"}
      </p>
      {detail && <p className="api-banner-detail">{detail}</p>}
      {apiBase && (
        <p className="api-banner-detail">
          점검 주소:{" "}
          <a
            href={`${apiBase}/api/health`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--cyan)" }}
          >
            {apiBase}/api/health
          </a>
        </p>
      )}
    </div>
  );
}
