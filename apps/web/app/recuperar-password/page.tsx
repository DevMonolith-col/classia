"use client"

import Link from "next/link"
import { useState } from "react"
import { AlertTriangle, ArrowLeft, Loader2, Mail, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-client"

export default function RecuperarPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [email, setEmail] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")

  /**
   * La pantalla de confirmación se muestra pase lo que pase con la cuenta: el backend
   * responde igual exista o no el correo, y contradecirlo acá volvería a filtrar por la UI
   * lo que el API se cuida de no decir. Solo un fallo de red o un 429 rompen ese silencio,
   * porque son sobre la petición, no sobre la cuenta.
   */
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSending(true)
    setError("")
    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        silent: true,
      })
      if (res.status === 429) {
        throw new Error("Demasiados intentos. Espera un minuto e inténtalo de nuevo.")
      }
      if (!res.ok) throw new Error("No se pudo enviar el correo. Inténtalo de nuevo.")
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setSending(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <span className="text-2xl font-bold text-primary-foreground">C</span>
              </div>
              <span className="text-2xl font-bold text-foreground">Classia</span>
            </Link>
          </div>

          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Revisa tu correo
              </h1>
              <p className="mt-2 text-muted-foreground">
                Hemos enviado instrucciones para restablecer tu contraseña a:
              </p>
              <p className="mt-2 font-medium text-foreground">{email}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                Si no recibes el correo en unos minutos, revisa tu carpeta de spam.
              </p>
              <Button variant="outline" className="mt-6 w-full" asChild>
                <Link href="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </Button>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            ¿No recibiste el correo?{" "}
            <button
              onClick={() => setSubmitted(false)}
              className="font-medium text-primary hover:underline"
            >
              Intentar de nuevo
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <span className="text-2xl font-bold text-primary-foreground">C</span>
            </div>
            <span className="text-2xl font-bold text-foreground">Classia</span>
          </Link>
          <p className="mt-2 text-sm text-muted-foreground">
            Plataforma de Gestión Escolar
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1 pb-4">
            <h1 className="text-center text-2xl font-bold text-foreground">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="text-center text-sm text-muted-foreground">
              No te preocupes. Ingresa tu correo y te enviaremos instrucciones para restablecerla.
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
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={sending}>
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar Instrucciones
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

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Necesitas ayuda?{" "}
          <Link href="#" className="font-medium text-primary hover:underline">
            Contacta soporte
          </Link>
        </p>
      </div>
    </div>
  )
}
