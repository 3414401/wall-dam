import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../../components/Layout";
import {
  getRandomRoom,
  sendRandomMessage,
  type RandomChatMessage,
} from "../../lib/api";
import { getUser } from "../../lib/auth";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const messagesRef = useRef<RandomChatMessage[]>([]);

  const refreshChat = useCallback(async () => {
    const data = await getRandomRoom(code);
    setSubject(data.room.subject);
    const next = data.messages ?? [];
    messagesRef.current = next;
    setMessages(next);
  }, [code]);

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
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-bubble-row ${msg.system ? "chat-system" : msg.authorName === authorName.trim() ? "chat-mine" : "chat-other"}`}
            >
              {!msg.system && msg.authorName !== authorName.trim() && (
                <span className="chat-author">{msg.authorName}</span>
              )}
              <div className={`chat-bubble ${msg.system ? "chat-bubble-system" : ""}`}>
                {msg.body.split("\n").map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < msg.body.split("\n").length - 1 && <br />}
                  </span>
                ))}
              </div>
              <span className="chat-time">{formatTime(msg.createdAt)}</span>
            </div>
          ))}
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
