const AUTH_KEY = "team_wall_user";

export interface User {
  username: string;
}

export function getUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function login(username: string, _password: string): User {
  const user = { username: username.trim() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  return user;
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
