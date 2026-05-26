import { toast } from "sonner"
import { clearTokens, getAccessToken, getRefreshToken, refreshAccessToken } from "./auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "demo"

type FetchOptions = RequestInit & {
  skipAuth?: boolean
  /** Silencia los toasts de error para este request específico */
  silent?: boolean
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export async function apiFetch(path: string, options: FetchOptions = {}): Promise<Response> {
  const { skipAuth = false, silent = false, ...fetchOptions } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Slug": TENANT_SLUG,
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers["Authorization"] = `Bearer ${token}`
  }

  let res: Response

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...fetchOptions,
      headers,
      credentials: "include",
    })
  } catch {
    if (!silent) {
      toast.error("Sin conexión con el servidor", {
        description: "Verifica que la aplicación esté disponible e intenta de nuevo.",
      })
    }
    throw new ApiError(0, "network_error")
  }

  // Refresh automático en 401
  if (res.status === 401 && !skipAuth && getRefreshToken()) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      const newToken = getAccessToken()
      if (newToken) headers["Authorization"] = `Bearer ${newToken}`
      try {
        return await fetch(`${API_URL}${path}`, { ...fetchOptions, headers, credentials: "include" })
      } catch {
        if (!silent) toast.error("Sin conexión con el servidor")
        throw new ApiError(0, "network_error")
      }
    }
    clearTokens()
    if (typeof window !== "undefined") window.location.href = "/login"
    throw new ApiError(401, "session_expired")
  }

  // Errores globales no relacionados con auth
  if (!res.ok && !silent) {
    if (res.status === 403) {
      toast.error("Sin permiso", {
        description: "No tienes acceso para realizar esta acción.",
      })
    } else if (res.status >= 500) {
      toast.error("Error del servidor", {
        description: "Ocurrió un problema. Intenta de nuevo en unos segundos.",
      })
    }
  }

  return res
}
