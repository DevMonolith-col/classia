"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"

const MIN_LENGTH = 6

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Classia</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  )
}

function RestablecerPasswordForm() {
  const router = useRouter()
  const token = useSearchParams().get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < MIN_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`)
      return
    }
    // La confirmación se valida acá y no en el backend a propósito: es una salvaguarda
    // contra el error de tipeo de quien la escribe, no una regla del servidor.
    if (password !== confirmation) {
      setError("Las dos contraseñas no coinciden.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        silent: true,
      })
      if (res.status === 401) {
        throw new Error(
          "El enlace no es válido o ya venció. Solicita uno nuevo desde «¿Olvidaste tu contraseña?».",
        )
      }
      if (res.status === 429) {
        throw new Error("Demasiados intentos. Espera un minuto e inténtalo de nuevo.")
      }
      if (!res.ok) throw new Error("No se pudo cambiar la contraseña. Inténtalo de nuevo.")
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setSaving(false)
    }
  }

  // Sin token no hay nada que hacer acá: se llega por el enlace del correo.
  if (!token) {
    return (
      <Shell>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Enlace incompleto</h1>
            <p className="mt-2 text-muted-foreground">
              Abre el enlace tal como llegó en el correo, sin recortarlo.
            </p>
            <Button variant="outline" className="mt-6 w-full" asChild>
              <Link href="/recuperar-password">Solicitar un enlace nuevo</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Contraseña actualizada</h1>
            <p className="mt-2 text-muted-foreground">
              Ya puedes entrar con tu contraseña nueva.
            </p>
            {/* Se avisa porque es visible: si tenía la sesión abierta en el celular, se le
                cerró, y sin explicación eso parece un error. */}
            <p className="mt-4 text-sm text-muted-foreground">
              Por seguridad cerramos las sesiones que tenías abiertas en otros dispositivos.
            </p>
            <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <Card>
        <CardHeader className="space-y-1 pb-4">
          <h1 className="text-center text-2xl font-bold text-foreground">Crea tu contraseña</h1>
          <p className="text-center text-sm text-muted-foreground">
            Elige una contraseña nueva para tu cuenta.
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
                Contraseña nueva
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_LENGTH}
                  required
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Mínimo {MIN_LENGTH} caracteres.
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmation"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Repite la contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmation"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar contraseña
            </Button>
          </form>

          <Button variant="ghost" className="mt-4 w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio de sesión
            </Link>
          </Button>
        </CardContent>
      </Card>
    </Shell>
  )
}

export default function RestablecerPasswordPage() {
  // useSearchParams obliga a un límite de Suspense para que la ruta pueda prerenderizarse.
  return (
    <Suspense
      fallback={
        <Shell>
          <Card>
            <CardContent className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </Shell>
      }
    >
      <RestablecerPasswordForm />
    </Suspense>
  )
}
