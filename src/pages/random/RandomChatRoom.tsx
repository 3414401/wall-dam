import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../../components/Layout";
import {
  diversityMatchRandomRoom,
  emailMatchResults,
  getRandomRoom,
  registerRandomRoomPresence,
  sendRandomMessage,
  type RandomChatMessage,
  type RandomDiversityMatch,
} from "../../lib/api";
import { getUser } from "../../lib/auth";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isEmailOptInMessage(msg: RandomChatMessage): boolean {
  if (msg.kind === "email_opt_in") return true;
  return (
    !!msg.system &&
    typeof msg.body === "string" &&
    msg.body.includes("팀원의 메일 주소를 내 메일로 받아보겠습니까")
  );
}

function loadAnsweredOptIns(): Record<string, boolean> {
  try {
    return JSON.parse(sessionStorage.getItem(OPT_IN_ANSWERED_KEY) ?? "{}") as Record<
      string,
      boolean
    >;
  } catch {
    return {};
  }
}

function markOptInAnswered(messageId: string) {
  const all = loadAnsweredOptIns();
  all[messageId] = true;
  sessionStorage.setItem(OPT_IN_ANSWERED_KEY, JSON.stringify(all));
}

export function RandomChatRoom() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [subject, setSubject] = useState("");
  const [messages, setMessages] = useState<RandomChatMessage[]>([]);
  const [authorName, setAuthorName] = useState(user?.username ?? "");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [matching, setMatching] = useState(false);
  const [emailBusyId, setEmailBusyId] = useState("");
  const [error, setError] = useState("");
  const [diversityMatch, setDiversityMatch] =
    useState<RandomDiversityMatch | null>(null);
  const [answeredOptIns, setAnsweredOptIns] = useState(loadAnsweredOptIns);
  const bottomRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const messagesRef = useRef<RandomChatMessage[]>([]);

  const isGoogleUser = user?.provider === "google" && !!user.email?.trim();

  const refreshChat = useCallback(async () => {
    const data = await getRandomRoom(code);
    setSubject(data.room.subject);
    const next = data.messages ?? [];
    messagesRef.current = next;
    setMessages(next);
    if (data.diversityMatch) {
      setDiversityMatch(data.diversityMatch);
    }
  }, [code]);

  useEffect(() => {
    if (!isGoogleUser || !user?.email) return;
    void registerRandomRoomPresence(
      code,
      user.email,
      user.username
    ).catch(() => {
      /* presence is best-effort */
    });
  }, [code, isGoogleUser, user?.email, user?.username]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refreshChat();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "채팅 로드 실패");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const poll = async () => {
      if (composingRef.current) return;
      try {
        const data = await getRandomRoom(code);
        if (cancelled) return;
        const next = data.messages ?? [];
        const prev = messagesRef.current;
        const changed =
          next.length !== prev.length ||
          next[next.length - 1]?.id !== prev[prev.length - 1]?.id;
        if (changed) {
          messagesRef.current = next;
          setMessages(next);
        }
        if (data.diversityMatch) {
          setDiversityMatch(data.diversityMatch);
        }
      } catch {
        /* ignore polling errors */
      }
    };

    const id = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [code, refreshChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleDiversityMatch() {
    setError("");
    setMatching(true);
    try {
      const result = await diversityMatchRandomRoom(code);
      setDiversityMatch({
        pairs: result.pairs,
        leftover: result.leftover,
        note: result.note,
        usedAi: result.usedAi,
        matchedAt: result.matchedAt,
      });
      setMessages(result.messages);
      messagesRef.current = result.messages;
    } catch (err) {
      setError(err instanceof Error ? err.message : "다양성 매칭 실패");
    } finally {
      setMatching(false);
    }
  }

  async function handleEmailOptIn(
    message: RandomChatMessage,
    accept: boolean
  ) {
    if (!accept) {
      markOptInAnswered(message.id);
      setAnsweredOptIns(loadAnsweredOptIns());
      if (!isGoogleUser || !user?.email) return;
    }

    if (!isGoogleUser || !user?.email) {
      setError("구글 계정으로 다시 로그인한 뒤 [예]를 눌러 주세요.");
      return;
    }
    setError("");
    setEmailBusyId(message.id);
    try {
      await registerRandomRoomPresence(code, user.email, user.username);
      const result = await emailMatchResults(code, {
        email: user.email,
        accept,
        matchAt: message.matchAt,
      });
      markOptInAnswered(message.id);
      setAnsweredOptIns(loadAnsweredOptIns());
      setMessages(result.messages);
      messagesRef.current = result.messages;
    } catch (err) {
      setError(err instanceof Error ? err.message : "메일 요청 실패");
    } finally {
      setEmailBusyId("");
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setError("");
    const text = draft.trim();
    const name = authorName.trim();
    if (!name || !text) return;

    setSending(true);
    try {
      const { messages: next } = await sendRandomMessage(code, name, text);
      setMessages(next);
      messagesRef.current = next;
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "전송 실패");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Layout title="채팅" onBack={() => navigate("/random/rooms")}>
        <p className="api-banner-detail">채팅방을 불러오는 중...</p>
      </Layout>
    );
  }

  return (
    <Layout
      title={`${subject} 채팅`}
      onBack={() => navigate("/random/rooms")}
    >
      <div className="chat-room">
        <div className="chat-match-bar">
          <button
            type="button"
            className="btn btn-accent btn-sm"
            onClick={handleDiversityMatch}
            disabled={matching}
          >
            {matching ? "매칭 중..." : "AI 다양성 매칭"}
          </button>
          <p className="chat-match-hint">
            AI가 공공데이터와 설문결과를 바탕으로 다양성이 가장 극대화 되는 팀원을
            매칭해 줍니다.
          </p>
        </div>

        {diversityMatch && diversityMatch.pairs.length > 0 && (
          <div className="chat-match-result">
            <h3 className="chat-match-result-title">
              다양성 매칭 결과
              {diversityMatch.usedAi ? " · AI" : " · 자동 균형"}
            </h3>
            <ul className="chat-match-pairs">
              {diversityMatch.pairs.map((pair) => (
                <li key={pair.pairIndex}>
                  <strong>{pair.pairIndex}조</strong>{" "}
                  {pair.members.map((m) => m.nickname).join(" × ")}
                  {pair.reason ? (
                    <span className="chat-match-reason">{pair.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {diversityMatch.leftover.length > 0 && (
              <p className="api-banner-detail">
                대기: {diversityMatch.leftover.map((m) => m.nickname).join(", ")}
              </p>
            )}
            {diversityMatch.note && (
              <p className="chat-match-note">{diversityMatch.note}</p>
            )}
          </div>
        )}

        <div className="chat-messages">
          {messages.map((msg) => {
            const optIn = isEmailOptInMessage(msg);
            const showOptIn = optIn && !answeredOptIns[msg.id];

            return (
              <div
                key={msg.id}
                className={`chat-bubble-row ${msg.system || optIn ? "chat-system" : msg.authorName === authorName.trim() ? "chat-mine" : "chat-other"}`}
              >
                {!msg.system && !optIn && msg.authorName !== authorName.trim() && (
                  <span className="chat-author">{msg.authorName}</span>
                )}
                <div
                  className={`chat-bubble ${msg.system || optIn ? "chat-bubble-system" : ""} ${optIn ? "chat-bubble-opt-in" : ""}`}
                >
                  {msg.body.split("\n").map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < msg.body.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                  {showOptIn && (
                    <div className="chat-opt-in-actions">
                      {!isGoogleUser && (
                        <p className="chat-opt-in-guest">
                          구글 계정으로 로그인한 뒤 [예]를 누르면 메일을 받을 수
                          있습니다.
                        </p>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm btn-opt-in-yes"
                        disabled={emailBusyId === msg.id || !isGoogleUser}
                        onClick={() => void handleEmailOptIn(msg, true)}
                      >
                        {emailBusyId === msg.id ? "처리 중..." : "예"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-opt-in-no"
                        disabled={emailBusyId === msg.id}
                        onClick={() => void handleEmailOptIn(msg, false)}
                      >
                        아니오
                      </button>
                    </div>
                  )}
                  {optIn && answeredOptIns[msg.id] && (
                    <p className="chat-opt-in-done">응답이 반영되었습니다.</p>
                  )}
                </div>
                <span className="chat-time">{formatTime(msg.createdAt)}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form className="chat-compose" onSubmit={handleSend}>
          <input
            className="input chat-name-input"
            placeholder="이름"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
          />
          <div className="chat-compose-row">
            <input
              className="input chat-input"
              placeholder="메시지 입력..."
              value={draft}
              onCompositionStart={() => {
                composingRef.current = true;
              }}
              onCompositionEnd={() => {
                composingRef.current = false;
              }}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-accent chat-send" disabled={sending}>
              {sending ? "…" : "전송"}
            </button>
          </div>
          {error && <p className="error-msg">{error}</p>}
        </form>
      </div>
    </Layout>
  );
}
