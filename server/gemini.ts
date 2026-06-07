export function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** 구형 모델(1.5-flash 등)은 404 — 목록에서 제외 */
const DEPRECATED = /gemini-1\.5-flash(?!-8b)/i;

/** 429·할당량 이슈가 잦은 모델 — 체인 끝으로 */
const QUOTA_HEAVY = /^gemini-2\.0-flash$/i;

/** 429 완화: 가벼운 모델 우선 */
const DEFAULT_MODEL_CHAIN = [
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash-8b",
];

let lastWorkingModel: string | null = null;

function modelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const preferred: string[] = [];
  const deferred: string[] = [];

  if (lastWorkingModel) preferred.push(lastWorkingModel);
  preferred.push(...DEFAULT_MODEL_CHAIN);

  if (fromEnv && !DEPRECATED.test(fromEnv)) {
    if (QUOTA_HEAVY.test(fromEnv)) deferred.push(fromEnv);
    else preferred.unshift(fromEnv);
  }

  return [...new Set([...preferred, ...deferred])];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(
  model: string,
  key: string,
  prompt: string,
  maxOutputTokens = 8192
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens,
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

function isRetryable(msg: string): boolean {
  return (
    msg.includes("404") ||
    msg.includes("NOT_FOUND") ||
    msg.includes("not found") ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

export async function generateText(
  prompt: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY가 없습니다. Render Environment에 키를 추가하세요."
    );
  }

  const models = modelCandidates();
  const maxTokens = options?.maxOutputTokens ?? 8192;
  const errors: string[] = [];

  for (const model of models) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const text = await callGemini(model, key, prompt, maxTokens);
        lastWorkingModel = model;
        return text;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(msg);
        if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        if (!isRetryable(msg)) {
          throw new Error(`Gemini API 오류: ${msg}`);
        }
        break;
      }
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

  let found: string | null = lastWorkingModel;
  if (found) {
    probeCache = { model: found, at: now };
    return found;
  }

  for (const model of modelCandidates()) {
    try {
      await callGemini(model, key, '{"ping":true}', 32);
      found = model;
      lastWorkingModel = model;
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
