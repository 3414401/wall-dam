import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { loginGuest, loginWithGoogle } from "../lib/auth";
import { renderGoogleSignInButton } from "../lib/googleAuth";

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = googleBtnRef.current;
    if (!el) return;

    let cancelled = false;

    void renderGoogleSignInButton(
      el,
      (profile) => {
        if (cancelled) return;
        loginWithGoogle(profile);
        navigate("/home", { replace: true });
      },
      () => {
        if (cancelled) return;
        setGoogleReady(false);
      }
    ).then((ok) => {
      if (cancelled) return;
      setGoogleReady(ok);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function handleGuestSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError("아이디를 입력해 주세요.");
      return;
    }
    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    setError("");
    loginGuest(username, password);
    navigate("/home", { replace: true });
  }

  return (
    <Layout
      title="월담(wall-jump)"
      subtitle="팀 학습 · 조짜기 · 랜덤 프로젝트"
    >
      <div className="btn-stack" style={{ marginTop: 0, marginBottom: 16 }}>
        <button
          type="button"
          className="btn btn-soft-green"
          onClick={() => {
            window.location.href = "https://3414401.github.io/walldam_calculate/";
          }}
        >
          공공데이터 분석 보러가기
        </button>
      </div>

      <section className="card login-panel">
        <h2 className="login-option-title">구글 계정으로 로그인</h2>
        <p className="login-option-desc">Google 계정으로 바로 입장합니다.</p>
        <div
          ref={googleBtnRef}
          className={`google-btn-host ${googleReady ? "is-ready" : ""}`}
          aria-label="Google 로그인"
        />
        {!googleReady && (
          <button type="button" className="btn btn-google" disabled>
            Google로 로그인
          </button>
        )}
      </section>

      <div className="login-divider" role="separator" aria-label="또는">
        <span>또는</span>
      </div>

      <section className="card login-panel">
        <h2 className="login-option-title">계정 없이 사용</h2>
        <p className="login-option-desc">
          아무 아이디, 비밀번호 입력하면 됩니다.
        </p>
        <form onSubmit={handleGuestSubmit}>
          <div className="field">
            <label className="label" htmlFor="username">
              아이디
            </label>
            <input
              id="username"
              className="input"
              placeholder="아이디 입력"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-accent" style={{ marginTop: 8 }}>
            계정 없이 시작 ⭐
          </button>
        </form>
      </section>
    </Layout>
  );
}
