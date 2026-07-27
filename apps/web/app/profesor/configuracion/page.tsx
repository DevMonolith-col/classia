"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  Bell,
  BookOpen,
  CalendarClock,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  LogOut,
  ShieldCheck,
} from "lucide-react"
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
 * Configuración del portal del profesor.
 *
 * Gemela de `/familia/ajustes`, y tenía el mismo problema: no era una maqueta sin conectar
 * sino una que **afirmaba cosas falsas**. Le mostraba a cualquier profesor el perfil de "Juan
 * López", `jlopez@colegio.edu` y un teléfono peruano, más una tarjeta académica con cuatro
 * cifras inventadas (Matemáticas, 3 cursos, 18 horas, 90 estudiantes). Y a diferencia de la
 * maqueta de incapacidades, esta **sí está en el sidebar**: los profesores entran acá.
 *
 * Queda solo lo que tiene backend detrás. Lo que se borró, y por qué:
 *
 * - **Notificaciones**: duplicaba `/profesor/notificaciones`, que sí guarda contra
 *   `GET/PUT /notifications/preferences`. Queda el enlace, no una segunda copia.
 * - **2FA**: no existe ni en el modelo ni en el roadmap aprobado.
 * - **Apariencia** (tema e idioma): `ThemeProvider` no se monta en ningún layout y no hay i18n
 *   en el repo, así que los dos eran botones sin efecto.
 * - **Centro de ayuda**: no hay pantalla de ayuda para el profesor a la que enlazar.
 *
 * El perfil quedó de **solo lectura**, misma razón que en el portal de familia: `TEACHER` no
 * tiene `USERS_UPDATE` y no hay endpoint de autoservicio, así que un formulario editable sería
 * otra vez un botón que no guarda nada.
 *
 * La tarjeta académica ahora se **deriva de `GET /schedules/mine`**, que es la misma fuente que
 * alimenta `/profesor/horario`: materias, cursos, clases por semana y horas de clase salen de
 * ahí. Se quitó "estudiantes": no se puede calcular sin pedir los rosters de cada grupo, y una
 * cifra inventada es justamente lo que esta pantalla tenía de más.
 */

interface Schedule {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  group: { id: string; name: string } | null
  subject: { id: string; name: string; code: string | null } | null
}

/** "HH:MM" → minutos desde medianoche. Devuelve null si el formato no es el esperado. */
function minutesOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/**
 * Horas de clase por semana, sumando la duración de cada franja del horario.
 *
 * Se saltean las franjas con horas ilegibles o invertidas en vez de contarlas como cero o como
 * negativo: es preferible que el total quede corto y sea verdadero a que una fila mal cargada
 * arrastre el número entero.
 */
function weeklyHours(schedules: Schedule[]): number {
  const totalMinutes = schedules.reduce((sum, schedule) => {
    const start = minutesOf(schedule.startTime)
    const end = minutesOf(schedule.endTime)
    if (start === null || end === null || end <= start) return sum
    return sum + (end - start)
  }, 0)

  return Math.round((totalMinutes / 60) * 10) / 10
}

function distinctCount(schedules: Schedule[], pick: (s: Schedule) => string | undefined): number {
  return new Set(schedules.map(pick).filter((id): id is string => Boolean(id))).size
}

export default function ProfesorConfiguracionPage() {
  const router = useRouter()
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [schedulesError, setSchedulesError] = useState("")

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true)
    setSchedulesError("")
    try {
      const res = await apiFetch("/schedules/mine", { silent: true })
      if (!res.ok) throw new Error("No se pudo cargar tu horario.")
      setSchedules((await res.json()) as Schedule[])
    } catch (err) {
      setSchedulesError(err instanceof Error ? err.message : "Error al conectar.")
    } finally {
      setLoadingSchedules(false)
    }
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  const academic = useMemo(
    () => ({
      subjects: distinctCount(schedules, (s) => s.subject?.id),
      groups: distinctCount(schedules, (s) => s.group?.id),
      classes: schedules.length,
      hours: weeklyHours(schedules),
    }),
    [schedules],
  )

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  const initials = user ? `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase() : ""

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Configuración</h1>
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
              <CardDescription>Datos con los que el colegio te tiene registrado</CardDescription>
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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Profesor</p>
                </div>
              </div>

              {/* Sin formulario editable a propósito: TEACHER no tiene USERS_UPDATE y no hay
                  endpoint de autoservicio. Un "Guardar cambios" que no guarda es lo que había. */}
              <p className="text-sm text-muted-foreground">
                Para corregir tus datos personales, escribe a la secretaría del colegio.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tu carga académica</CardTitle>
              <CardDescription>Calculada sobre tu horario asignado</CardDescription>
            </CardHeader>
            <CardContent>
              {schedulesError ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{schedulesError}</p>
                </div>
              ) : loadingSchedules ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="h-20 animate-pulse rounded-lg bg-secondary" />
                  <div className="h-20 animate-pulse rounded-lg bg-secondary" />
                  <div className="h-20 animate-pulse rounded-lg bg-secondary" />
                  <div className="h-20 animate-pulse rounded-lg bg-secondary" />
                </div>
              ) : schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no tienes clases asignadas en el horario.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard
                    icon={<BookOpen className="h-5 w-5 text-blue-500" />}
                    tint="bg-blue-500/10"
                    label="Materias"
                    value={String(academic.subjects)}
                  />
                  <StatCard
                    icon={<GraduationCap className="h-5 w-5 text-green-500" />}
                    tint="bg-green-500/10"
                    label="Cursos"
                    value={String(academic.groups)}
                  />
                  <StatCard
                    icon={<CalendarClock className="h-5 w-5 text-orange-500" />}
                    tint="bg-orange-500/10"
                    label="Clases por semana"
                    value={String(academic.classes)}
                  />
                  <StatCard
                    icon={<Clock className="h-5 w-5 text-purple-500" />}
                    tint="bg-purple-500/10"
                    label="Horas de clase"
                    value={`${academic.hours} h`}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Las preferencias reales viven en /profesor/notificaciones y guardan contra la API. */}
          <Card>
            <CardContent className="p-4">
              <Link
                href="/profesor/notificaciones"
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

function StatCard({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode
  tint: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

/**
 * Idéntica a la de `/familia/ajustes`. Se deja duplicada en vez de extraer un componente
 * compartido porque son dos portales con layouts y copy propios, y hoy la única diferencia
 * sería el import; si aparece un tercero, ahí conviene extraerla.
 */
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
