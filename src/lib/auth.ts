const AUTH_KEY = "team_wall_user";

export type AuthProvider = "guest" | "google";

export interface User {
  username: string;
  provider: AuthProvider;
  email?: string;
  picture?: string;
  /** 게스트 admin 계정 */
  isAdmin?: boolean;
}

export const ADMIN_USERNAME = "admin";
export const ADMIN_PASSWORD = "admin1234";

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    if (!parsed.username?.trim()) return null;
    const username = parsed.username.trim();
    const isAdmin =
      parsed.isAdmin === true ||
      (parsed.provider !== "google" &&
        username.toLowerCase() === ADMIN_USERNAME);
    return {
      username,
      provider: parsed.provider === "google" ? "google" : "guest",
      email: parsed.email,
      picture: parsed.picture,
      ...(isAdmin ? { isAdmin: true } : {}),
    };
  } catch {
    return null;
  }
}

export function loginGuest(username: string, password: string): User {
  const name = username.trim();
  if (!name) {
    throw new Error("아이디를 입력해 주세요.");
  }
  if (!password.trim()) {
    throw new Error("비밀번호를 입력해 주세요.");
  }

  if (name.toLowerCase() === ADMIN_USERNAME) {
    if (password !== ADMIN_PASSWORD) {
      throw new Error("admin 계정 비밀번호가 올바르지 않습니다.");
    }
    const user: User = {
      username: ADMIN_USERNAME,
      provider: "guest",
      isAdmin: true,
    };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }

  const user: User = {
    username: name,
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
