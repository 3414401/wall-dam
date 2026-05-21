import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { login } from "../lib/auth";

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError("아이디를 입력해 주세요.");
      return;
    }
    if (!password.trim()) {
      setError("비밀번호를 입력해 주세요.");
      return;
    }
    login(username, password);
    navigate("/home", { replace: true });
  }

  return (
    <Layout
      title="담을 넘는 조짜기"
      subtitle="함께 벽을 넘어 최고의 팀을 만들어요"
    >
      <form className="card" onSubmit={handleSubmit}>
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
          로그인 ⭐
        </button>
      </form>
      <p className="page-subtitle" style={{ textAlign: "center", marginTop: 20 }}>
        데모: 아무 아이디·비밀번호로 입장 가능
      </p>
    </Layout>
  );
}
