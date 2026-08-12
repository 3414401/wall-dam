const PRODUCTION_API_FALLBACK = "https://wall-dam.onrender.com";

type AppConfig = {
  apiUrl?: string;
  googleClientId?: string;
};

let resolvedApiBase: string | null = null;
let resolvedGoogleClientId: string | null = null;
let configLoaded = false;

function configJsonUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const path = base.endsWith("/") ? `${base}config.json` : `${base}/config.json`;
  return new URL(path, window.location.origin).href;
}

export async function loadApiConfig(): Promise<string> {
  if (configLoaded && resolvedApiBase !== null) return resolvedApiBase;

  const fromBuildApi = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  const fromBuildGoogle = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

  if (fromBuildApi) {
    resolvedApiBase = fromBuildApi;
  }
  if (fromBuildGoogle) {
    resolvedGoogleClientId = fromBuildGoogle;
  }

  try {
    const res = await fetch(configJsonUrl(), { cache: "no-store" });
    if (res.ok) {
      const cfg = (await res.json()) as AppConfig;
      const url = cfg.apiUrl?.trim().replace(/\/$/, "") ?? "";
      if (!resolvedApiBase && url) {
        resolvedApiBase = url;
      }
      const googleId = cfg.googleClientId?.trim() ?? "";
      if (!resolvedGoogleClientId && googleId) {
        resolvedGoogleClientId = googleId;
      }
    }
  } catch {
    /* ignore */
  }

  if (!resolvedApiBase) {
    if (import.meta.env.PROD) {
      resolvedApiBase = PRODUCTION_API_FALLBACK;
    } else {
      resolvedApiBase = "";
    }
  }

  if (resolvedGoogleClientId === null) {
    resolvedGoogleClientId = "";
  }

  configLoaded = true;
  return resolvedApiBase;
}

export function getApiBase(): string {
  return resolvedApiBase ?? import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
}

export function getGoogleClientId(): string {
  return (
    resolvedGoogleClientId ??
    import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ??
    ""
  );
}
