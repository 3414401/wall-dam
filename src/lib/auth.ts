const AUTH_KEY = "team_wall_user";

export type AuthProvider = "guest" | "google";

export interface User {
  username: string;
  provider: AuthProvider;
  email?: string;
  picture?: string;
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    if (!parsed.username?.trim()) return null;
    return {
      username: parsed.username.trim(),
      provider: parsed.provider === "google" ? "google" : "guest",
      email: parsed.email,
      picture: parsed.picture,
    };
  } catch {
    return null;
  }
}

export function loginGuest(username: string, _password: string): User {
  const user: User = {
    username: username.trim(),
    provider: "guest",
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
}

/** @deprecated use loginGuest */
export function login(username: string, password: string): User {
  return loginGuest(username, password);
}

export function loginWithGoogle(profile: {
  name: string;
  email?: string;
  picture?: string;
}): User {
  const user: User = {
    username: profile.name.trim() || profile.email?.trim() || "Google 사용자",
    provider: "google",
    email: profile.email?.trim(),
    picture: profile.picture,
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
