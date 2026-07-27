"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bell, ChevronRight, Eye, EyeOff, LogOut, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiFetch } from "@/lib/api-client"
import { getRefreshToken, getStoredUser, logout } from "@/lib/auth"

/**
 * Ajustes del portal de familia.
 *
 * Esta pantalla era una maqueta que **inventaba datos**: mostraba a "Roberto García",
 * `rgarcia@gmail.com`, un teléfono peruano y una dirección en Lima a cualquiera que entrara,
 * más dos hijos y una apoderada que no existen. Lo que quedó es solo lo que tiene backend
 * detrás. Lo que se borró, y por qué:
 *
 * - **Notificaciones**: duplicaba `/familia/notificaciones`, que sí guarda contra
 *   `GET/PUT /notifications/preferences`. Queda el enlace, no una segunda copia que se
 *   desincroniza.
 * - **2FA** y **apoderados autorizados**: no existen ni en el modelo ni en el roadmap
 *   aprobado.
 * - **Apariencia** (tema e idioma): `ThemeProvider` no se monta en ningún layout y no hay i18n
 *   en el repo, así que los dos eran botones sin efecto.
 * - **Centro de ayuda**: no hay pantalla de ayuda para familia a la que enlazar.
 *
 * El perfil quedó de **solo lectura**: el acudiente no tiene `USERS_UPDATE` ni
 * `GUARDIANS_UPDATE`, y no hay endpoint de autoservicio. Un formulario editable acá sería otra
 * vez un botón que no guarda nada.
 */

interface Student {
  id: string
  firstName: string
  lastName: string
  group: { name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  GUARDIAN: "Acudiente",
  STUDENT: "Estudiante",
}

export default function FamiliaAjustesPage() {
  const router = useRouter()
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [studentsError, setStudentsError] = useState("")

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true)
    setStudentsError("")
    try {
      const res = await apiFetch("/students/mine", { silent: true })
      if (!res.ok) throw new Error("No se pudieron cargar los estudiantes vinculados.")
      setStudents((await res.json()) as Student[])
    } catch (err) {
      setStudentsError(err instanceof Error ? err.message : "Error al conectar.")
    } finally {
      setLoadingStudents(false)
    }
  }, [])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : ""

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Ajustes</h1>
        <p className="mt-1 text-muted-foreground">Administra tu cuenta</p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="seguridad">Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tu cuenta</CardTitle>
              <CardDescription>
                Datos con los que el colegio te tiene registrado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                    {initials || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {user ? `${user.firstName} ${user.lastName}` : "—"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{user?.email ?? "—"}</p>
                  {user?.role && (
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {ROLE_LABELS[user.role] ?? user.role}
                    </p>
                  )}
                </div>
              </div>

              {/* Sin formulario editable a propósito: no hay endpoint de autoservicio, y un
                  "Guardar cambios" que no guarda es peor que no ofrecerlo. */}
              <p className="text-sm text-muted-foreground">
                Para corregir tus datos personales, escribe a la secretaría del colegio.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estudiantes vinculados</CardTitle>
              <CardDescription>Las fichas a las que tienes acceso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {studentsError && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{studentsError}</p>
                </div>
              )}

              {loadingStudents ? (
                <div className="h-16 animate-pulse rounded-lg bg-secondary" />
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tienes estudiantes vinculados.</p>
              ) : (
                students.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-4"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {`${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {student.group?.name ?? "Sin curso asignado"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Las preferencias reales viven en /familia/notificaciones y guardan contra la API.
              Acá va el enlace y no una segunda copia de los mismos switches. */}
          <Card>
            <CardContent className="p-4">
              <Link
                href="/familia/notificaciones"
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <Bell className="h-5 w-5 text-foreground" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">Preferencias de notificación</p>
                    <p className="text-sm text-muted-foreground">
                      Elige qué avisos quieres recibir y por dónde
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seguridad" className="space-y-6">
          <ChangePasswordCard />
        </TabsContent>
      </Tabs>

      <Card className="mt-8 border-destructive/20">
        <CardContent className="p-4">
          <button onClick={handleLogout} className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <LogOut className="h-5 w-5 text-destructive" />
              </div>
              <div className="text-left">
                <p className="font-medium text-destructive">Cerrar sesión</p>
                <p className="text-sm text-muted-foreground">Salir de tu cuenta</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </CardContent>
      </Card>
    </div>
  )
}

function ChangePasswordCard() {
  const [showCurrent, setShowCurrent] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setCurrent("")
    setNext("")
    setConfirm("")
    setShowCurrent(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    if (next !== confirm) {
      setError("La confirmación no coincide con la contraseña nueva.")
      return
    }
    if (next.length < 6) {
      setError("La contraseña nueva debe tener al menos 6 caracteres.")
      return
    }
    if (next === current) {
      setError("La contraseña nueva debe ser distinta de la actual.")
      return
    }

    // El JWT no lleva el id de sesión, así que el servidor identifica "esta sesión" por el
    // refresh token: es la que se conserva cuando cierra todas las demás.
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      setError("Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.")
      return
    }

    setSaving(true)
    try {
      const res = await apiFetch("/auth/change-password", {
        method: "POST",
        silent: true,
        body: JSON.stringify({ currentPassword: current, newPassword: next, refreshToken }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        // El backend responde 403 —no 401— cuando la contraseña actual no coincide,
        // justamente para que `apiFetch` no lo confunda con un token vencido y cierre
        // la sesión de quien solo se equivocó al escribir.
        throw new Error(
          body?.message ??
            (res.status === 403
              ? "La contraseña actual no es correcta."
              : "No se pudo actualizar la contraseña."),
        )
      }

      reset()
      toast.success("Tu contraseña quedó actualizada", {
        description: "Se cerraron las demás sesiones abiertas de tu cuenta.",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la contraseña.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>
          Al cambiarla se cierran las demás sesiones de tu cuenta. Esta se mantiene abierta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Actualizando…" : "Actualizar contraseña"}
            </Button>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Mínimo 6 caracteres
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
