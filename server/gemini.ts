export function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

const DEFAULT_MODEL_CHAIN = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
];

function modelCandidates(): string[] {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  const list = fromEnv ? [fromEnv, ...DEFAULT_MODEL_CHAIN] : DEFAULT_MODEL_CHAIN;
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
      const notFound =
        msg.includes("404") ||
        msg.includes("NOT_FOUND") ||
        msg.includes("not found");
      if (!notFound) throw new Error(`Gemini API 오류: ${msg}`);
    }
  }

  throw new Error(
    `사용 가능한 Gemini 모델을 찾지 못했습니다. Render에 GEMINI_MODEL=gemini-2.0-flash 를 설정해 보세요. (${errors[0] ?? ""})`
  );
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
