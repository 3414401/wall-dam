import nodemailer from "nodemailer";

export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY?.trim()) return true;
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

export function emailProviderLabel(): string {
  if (process.env.RESEND_API_KEY?.trim()) return "Resend";
  if (process.env.SMTP_HOST?.trim()) return "SMTP";
  return "none";
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} 시간 초과 (${ms / 1000}초). 메일 설정을 확인해 주세요.`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const from =
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "월담 <onboarding@resend.dev>";

  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    const res = await withTimeout(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [options.to],
          subject: options.subject,
          text: options.text,
        }),
      }),
      15000,
      "Resend"
    );
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`메일 발송 실패 (Resend): ${detail}`);
    }
    return;
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    throw new Error(
      "메일 서버가 설정되지 않았습니다. Render에 RESEND_API_KEY(권장) 또는 SMTP 설정을 등록해 주세요."
    );
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  try {
    await withTimeout(
      transporter.sendMail({
        from: process.env.EMAIL_FROM?.trim() || user,
        to: options.to,
        subject: options.subject,
        text: options.text,
      }),
      20000,
      "SMTP"
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `메일 발송 실패 (SMTP). Render는 Gmail SMTP를 막는 경우가 많습니다. Resend(RESEND_API_KEY) 사용을 권장합니다. 상세: ${msg}`
    );
  } finally {
    transporter.close();
  }
}
