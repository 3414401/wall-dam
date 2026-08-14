import { getGoogleClientId } from "./apiConfig";

const GIS_SRC = "https://accounts.google.com/gsi/client";

type CredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      locale?: string;
    }
  ) => void;
  prompt: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

export type GoogleProfile = {
  name: string;
  email?: string;
  picture?: string;
};

let scriptPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Google 로그인 스크립트를 불러오지 못했습니다."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function decodeJwtPayload(credential: string): Record<string, unknown> {
  const parts = credential.split(".");
  if (parts.length < 2) throw new Error("잘못된 Google 로그인 응답입니다.");
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
  // atob returns binary Latin-1; Korean names need UTF-8 decode
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const json = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(json) as Record<string, unknown>;
}

export function parseGoogleCredential(credential: string): GoogleProfile {
  const payload = decodeJwtPayload(credential);
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const name =
    (typeof payload.name === "string" && payload.name) ||
    (typeof payload.given_name === "string" && payload.given_name) ||
    email ||
    "Google 사용자";
  const picture = typeof payload.picture === "string" ? payload.picture : undefined;
  return { name, email, picture };
}

export async function renderGoogleSignInButton(
  container: HTMLElement,
  onCredential: (profile: GoogleProfile) => void,
  onError: (message: string) => void
): Promise<boolean> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    onError(
      "Google 로그인 Client ID가 아직 설정되지 않았습니다. config.json의 googleClientId를 등록해 주세요."
    );
    return false;
  }

  try {
    await loadGisScript();
  } catch (err) {
    onError(err instanceof Error ? err.message : "Google 로그인을 준비하지 못했습니다.");
    return false;
  }

  if (!window.google?.accounts?.id) {
    onError("Google 로그인 API를 사용할 수 없습니다.");
    return false;
  }

  container.innerHTML = "";

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => {
      try {
        if (!response.credential) {
          onError("Google 로그인에 실패했습니다. 다시 시도해 주세요.");
          return;
        }
        onCredential(parseGoogleCredential(response.credential));
      } catch (err) {
        onError(err instanceof Error ? err.message : "Google 로그인 처리 중 오류가 났습니다.");
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  const width = Math.min(Math.max(container.clientWidth || 320, 240), 400);
  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
    width,
    locale: "ko",
  });

  return true;
}
