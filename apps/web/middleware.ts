import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = new Set(["/", "/login", "/registro", "/recuperar-password"])

const ROLE_SECTION: Record<string, string> = {
  SUPER_ADMIN: "/superadmin",
  SUPPORT_SUPERVISOR: "/superadmin",
  SUPPORT_AGENT: "/superadmin",
  TENANT_ADMIN: "/admin",
  PRINCIPAL: "/admin",
  COORDINATOR: "/admin",
  SECRETARY: "/admin",
  TEACHER: "/profesor",
  GUARDIAN: "/familia",
  STUDENT: "/alumno",
}

const PROTECTED_SECTIONS = ["/superadmin", "/admin", "/profesor", "/familia", "/alumno"]

function decodeJwtPayload(token: string): { role: string; exp: number } | null {
  try {
    const part = token.split(".")[1]
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as { role: string; exp: number }
  } catch {
    return null
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignorar assets de Next.js
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next()
  }

  const accessToken = request.cookies.get("classia_at")?.value
  const refreshToken = request.cookies.get("classia_rt")?.value

  // Rutas públicas
  if (PUBLIC_PATHS.has(pathname)) {
    // Si ya tiene sesión activa, redirigir a su sección
    if (pathname === "/login" && accessToken) {
      const payload = decodeJwtPayload(accessToken)
      if (payload && payload.exp * 1000 > Date.now()) {
        const section = ROLE_SECTION[payload.role] ?? "/login"
        return NextResponse.redirect(new URL(section, request.url))
      }
    }
    return NextResponse.next()
  }

  // Rutas protegidas: necesita al menos el refresh token
  const inProtectedSection = PROTECTED_SECTIONS.some((s) => pathname.startsWith(s))

  if (inProtectedSection && !accessToken && !refreshToken) {
    const url = new URL("/login", request.url)
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  // Si tiene access token válido, verificar que esté en su sección correcta
  if (accessToken) {
    const payload = decodeJwtPayload(accessToken)
    if (payload && payload.exp * 1000 > Date.now()) {
      const correctSection = ROLE_SECTION[payload.role]
      const currentSection = PROTECTED_SECTIONS.find((s) => pathname.startsWith(s))

      if (correctSection && currentSection && currentSection !== correctSection) {
        // Permitir que quien puede impersonar acceda a /admin (modo impersonación).
        // Alineado con el backend (auth.service.impersonate): solo SUPER_ADMIN y
        // SUPPORT_SUPERVISOR pueden entrar al colegio; el agente no.
        if (
          (payload.role === "SUPER_ADMIN" || payload.role === "SUPPORT_SUPERVISOR") &&
          currentSection === "/admin"
        ) {
          return NextResponse.next()
        }
        return NextResponse.redirect(new URL(correctSection, request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
