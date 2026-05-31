import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "../../components/Layout";
import {
  getRandomRoom,
  sendRandomMessage,
  type RandomChatMessage,
} from "../../lib/api";
import { getUser } from "../../lib/auth";

const ENTRY_CODE_KEY = "random_chat_entry_codes";

function loadEntryCodes(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(ENTRY_CODE_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

function saveEntryCode(roomCode: string, entryCode: string) {
  const all = loadEntryCodes();
  all[roomCode] = entryCode;
  sessionStorage.setItem(ENTRY_CODE_KEY, JSON.stringify(all));
}

function getSavedEntryCode(roomCode: string): string {
  return loadEntryCodes()[roomCode] ?? "";
}

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
  const [step, setStep] = useState<"code" | "chat">(
    getSavedEntryCode(code) ? "chat" : "code"
  );
  const [entryCode, setEntryCode] = useState(getSavedEntryCode(code));
  const [subject, setSubject] = useState("");
  const [messages, setMessages] = useState<RandomChatMessage[]>([]);
  const [authorName, setAuthorName] = useState(user?.username ?? "");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const refreshChat = useCallback(async (codeValue: string) => {
    const data = await getRandomRoom(code, codeValue);
    if (!data.chatAccess) {
      throw new Error("입장 코드가 올바르지 않습니다.");
    }
    setSubject(data.room.subject);
    setMessages(data.messages ?? []);
  }, [code]);

  useEffect(() => {
    if (step !== "chat" || !entryCode) return;

    let cancelled = false;
    void (async () => {
      try {
        await refreshChat(entryCode);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "채팅 로드 실패");
          setStep("code");
        }
      }
    })();

    const poll = async () => {
      try {
        const data = await getRandomRoom(code, entryCode);
        if (cancelled) return;
        setMessages(data.messages ?? []);
      } catch {
        /* ignore polling errors */
      }
    };

    const id = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, code, entryCode, refreshChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = entryCode.replace(/\D/g, "");
    if (trimmed.length !== 6) {
      setError("6자리 입장 코드를 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      await refreshChat(trimmed);
      saveEntryCode(code, trimmed);
      setEntryCode(trimmed);
      setStep("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장 실패");
    } finally {
      setLoading(false);
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
      const { messages: next } = await sendRandomMessage(
        code,
        entryCode,
        name,
        text
      );
      setMessages(next);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "전송 실패");
    } finally {
      setSending(false);
    }
  }

  if (step === "code") {
    return (
      <Layout
        title="채팅 입장"
        subtitle={`방 코드 ${code}`}
        onBack={() => navigate("/random/chat")}
      >
        <form className="card" onSubmit={handleCodeSubmit}>
          <div className="field">
            <label className="label" htmlFor="chat-entry-code">
              입장 코드 (6자리)
            </label>
            <input
              id="chat-entry-code"
              className="input code-input"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={entryCode}
              onChange={(e) =>
                setEntryCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="btn btn-accent" disabled={loading}>
            {loading ? "확인 중..." : "채팅 입장 💬"}
          </button>
        </form>
      </Layout>
    );
  }

  return (
    <Layout
      title={`${subject} 채팅`}
      subtitle={`방 ${code}`}
      onBack={() => navigate("/random/chat")}
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
