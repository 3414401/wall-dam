export function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** 구형 모델(1.5-flash 등)은 404 — 목록에서 제외 */
const DEPRECATED = /gemini-1\.5-flash(?!-8b)/i;

const DEFAULT_MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-8b",
];

function modelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const list: string[] = [];
  if (fromEnv && !DEPRECATED.test(fromEnv)) list.push(fromEnv);
  list.push(...DEFAULT_MODEL_CHAIN);
  return [...new Set(list)];
}

async function callGemini(model: string, key: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${model}: ${res.status} ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`${model}: 응답이 비어 있습니다.`);
  return text;
}

export async function generateText(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY가 없습니다. Render Environment에 키를 추가하세요."
    );
  }

  const models = modelCandidates();
  const errors: string[] = [];

  for (const model of models) {
    try {
      return await callGemini(model, key, prompt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      const retryable =
        msg.includes("404") ||
        msg.includes("NOT_FOUND") ||
        msg.includes("not found") ||
        msg.includes("429") ||
        msg.includes("503");
      if (!retryable) throw new Error(`Gemini API 오류: ${msg}`);
    }
  }

  throw new Error(
    `Gemini 모델 연결 실패. Render에서 GEMINI_MODEL을 삭제하거나 gemini-2.5-flash 로 설정 후 재배포하세요. (${errors[0] ?? ""})`
  );
}

let probeCache: { model: string | null; at: number } | null = null;
const PROBE_CACHE_MS = 600_000;

/** health 체크용 — 동작하는 모델 이름 반환 */
export async function probeGeminiModel(): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;

  const now = Date.now();
  if (probeCache && now - probeCache.at < PROBE_CACHE_MS) {
    return probeCache.model;
  }

  let found: string | null = null;
  for (const model of modelCandidates()) {
    try {
      await callGemini(model, key, '{"ping":true}');
      found = model;
      break;
    } catch {
      /* try next */
    }
  }
  probeCache = { model: found, at: now };
  return found;
}

export function parseJsonFromText<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("JSON을 찾을 수 없습니다.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as T;
}
