const PRODUCTION_API_FALLBACK = "https://wall-dam.onrender.com";

let resolvedApiBase: string | null = null;

function configJsonUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const path = base.endsWith("/") ? `${base}config.json` : `${base}/config.json`;
  return new URL(path, window.location.origin).href;
}

export async function loadApiConfig(): Promise<string> {
  if (resolvedApiBase !== null) return resolvedApiBase;

  const fromBuild = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  if (fromBuild) {
    resolvedApiBase = fromBuild;
    return resolvedApiBase;
  }

  try {
    const res = await fetch(configJsonUrl(), { cache: "no-store" });
    if (res.ok) {
      const cfg = (await res.json()) as { apiUrl?: string };
      const url = cfg.apiUrl?.trim().replace(/\/$/, "") ?? "";
      if (url) {
        resolvedApiBase = url;
        return resolvedApiBase;
      }
    }
  } catch {
    /* ignore */
  }

  if (import.meta.env.PROD) {
    resolvedApiBase = PRODUCTION_API_FALLBACK;
    return resolvedApiBase;
  }

  resolvedApiBase = "";
  return resolvedApiBase;
}
export function getApiBase(): string {
  return resolvedApiBase ?? import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
}
