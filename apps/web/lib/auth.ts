import { API_URL, TENANT_SLUG } from "./env"

export type JwtPayload = {
  sub: string
  email: string
  tenantId: string
  tenantSlug: string
  membershipId: string
  role: string
  exp: number
  iat: number
}

export type LoginResult = {
  accessToken: string
  refreshToken: string
  user: { id: string; email: string; firstName: string; lastName: string }
  tenant: { id: string; slug: string }
  membership: { id: string; role: string }
}

const ROLE_ROUTES: Record<string, string> = {
  SUPER_ADMIN: "/admin",
  SUPPORT_AGENT: "/admin",
  TENANT_ADMIN: "/admin",
  PRINCIPAL: "/admin",
  COORDINATOR: "/admin",
  SECRETARY: "/admin",
  TEACHER: "/profesor",
  GUARDIAN: "/familia",
  STUDENT: "/familia",
}

export function getRoleRoute(role: string): string {
  return ROLE_ROUTES[role] ?? "/login"
}

// ─── Cookies ─────────────────────────────────────────────────────────────────

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

export function setTokens(accessToken: string, refreshToken: string) {
  setCookie("classia_at", accessToken, 15 * 60)
  setCookie("classia_rt", refreshToken, 30 * 24 * 3600)
}

export function clearTokens() {
  deleteCookie("classia_at")
  deleteCookie("classia_rt")
  if (typeof localStorage !== "undefined") localStorage.removeItem("classia_user")
}

export function getAccessToken(): string | null {
  return getCookie("classia_at")
}

export function getRefreshToken(): string | null {
  return getCookie("classia_rt")
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1]
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as JwtPayload
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token)
  if (!payload) return true
  return payload.exp * 1000 < Date.now()
}

export function getCurrentUser(): JwtPayload | null {
  const token = getAccessToken()
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload || isTokenExpired(token)) return null
  return payload
}

// ─── User info cache ─────────────────────────────────────────────────────────

type StoredUser = { firstName: string; lastName: string; email: string; role: string }

export function setStoredUser(user: StoredUser) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem("classia_user", JSON.stringify(user))
}

export function getStoredUser(): StoredUser | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = localStorage.getItem("classia_user")
    return raw ? (JSON.parse(raw) as StoredUser) : null
  } catch {
    return null
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, tenantSlug: TENANT_SLUG }),
    credentials: "include",
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(body.message ?? "Credenciales incorrectas")
  }

  const data = (await res.json()) as LoginResult
  setTokens(data.accessToken, data.refreshToken)
  setStoredUser({
    firstName: data.user.firstName,
    lastName: data.user.lastName,
    email: data.user.email,
    role: data.membership.role,
  })
  return data
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (refreshToken) {
    // El catch es intencional: si la API no responde igual limpiamos tokens locales
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": TENANT_SLUG },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    }).catch(() => {})
  }
  clearTokens()
}

export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Tenant-Slug": TENANT_SLUG },
      body: JSON.stringify({ refreshToken }),
      credentials: "include",
    })
    if (!res.ok) return false
    const data = (await res.json()) as { accessToken: string; refreshToken: string }
    setTokens(data.accessToken, data.refreshToken)
    return true
  } catch {
    return false
  }
}
