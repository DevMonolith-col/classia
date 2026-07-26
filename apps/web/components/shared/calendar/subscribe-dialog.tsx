"use client"

// Suscripción al calendario del colegio por feed ICS (docs/planning/calendario.md, Fase 5).
//
// Vive en shared/ porque no tiene nada de admin: el feed es **por usuario**, y los portales de
// familia, profesor y alumno de la Fase 4 usan este mismo diálogo sin cambios.
//
// La URL es una *capability URL*: quien la tenga ve el calendario de esta persona sin
// contraseña. El diálogo lo dice explícitamente en vez de esconderlo, y el enlace se muestra
// una sola vez — el backend solo guarda su hash, así que "volver a verlo" no existe: se
// regenera, y eso invalida la suscripción anterior.

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Calendar, Check, Copy, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ApiError, apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TokenStatus = {
  active: boolean
  createdAt: string | null
  lastUsedAt: string | null
}

type IssuedToken = {
  feedUrl: string
  webcalUrl: string
  qrDataUrl: string
  createdAt: string
}

function formatDate(value: string | null) {
  if (!value) return "nunca"
  return new Date(value).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CalendarSubscribeDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<TokenStatus | null>(null)
  const [issued, setIssued] = useState<IssuedToken | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await apiFetch("/calendar/feed/token", { silent: true })
      if (!res.ok) throw new Error("No se pudo consultar el estado de la suscripción.")
      setStatus((await res.json()) as TokenStatus)
    } catch (err) {
      if (err instanceof ApiError) setError("No se pudo conectar con el servidor.")
      else setError(err instanceof Error ? err.message : "No se pudo consultar la suscripción.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      // El enlace en claro no sobrevive al cierre del diálogo: no tiene por qué quedar en
      // memoria de la pantalla después de que la persona lo copió.
      setIssued(null)
      setCopied(false)
      // También se descarta el estado. Al emitir un token se setea de forma optimista con
      // `lastUsedAt: null`, y si esa copia sobrevive al cierre, la próxima apertura muestra
      // "última lectura: nunca" aunque el feed ya se haya leído — visto en el navegador con
      // la base diciendo lo contrario. Con `status` en null la reapertura muestra el spinner
      // hasta tener el dato del servidor, así que no hay ventana para mostrar algo viejo.
      setStatus(null)
      return
    }
    loadStatus()
  }, [open, loadStatus])

  async function issue() {
    setBusy(true)
    setError("")
    try {
      const res = await apiFetch("/calendar/feed/token", { method: "POST", silent: true })
      if (!res.ok) {
        if (res.status === 429) throw new Error("Demasiados intentos. Espera un minuto.")
        throw new Error("No se pudo generar el enlace.")
      }
      const data = (await res.json()) as IssuedToken
      setIssued(data)
      setStatus({ active: true, createdAt: data.createdAt, lastUsedAt: null })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el enlace.")
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    setBusy(true)
    setError("")
    try {
      const res = await apiFetch("/calendar/feed/token", { method: "DELETE", silent: true })
      if (!res.ok) throw new Error("No se pudo revocar la suscripción.")
      setIssued(null)
      setStatus({ active: false, createdAt: null, lastUsedAt: null })
      toast.success("Suscripción revocada", {
        description: "El enlace anterior dejó de funcionar de inmediato.",
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar la suscripción.")
    } finally {
      setBusy(false)
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Suscribir a mi calendario
          </DialogTitle>
          <DialogDescription>
            Agrega el calendario del colegio a Google Calendar, Apple Calendar u Outlook. Se
            actualiza solo: no hay que volver a importar nada cuando cambia un evento.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Consultando tu suscripción…
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {issued ? (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Copia el enlace ahora: no se vuelve a mostrar.</p>
                    <p className="mt-0.5 text-xs opacity-90">
                      Cualquiera que tenga este enlace puede ver tu calendario sin contraseña.
                      No lo compartas. Si se te pierde, genera uno nuevo desde acá y el
                      anterior deja de servir.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="feed-url">Tu enlace de suscripción</Label>
                  <div className="flex gap-2">
                    <Input id="feed-url" readOnly value={issued.webcalUrl} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copiar enlace"
                      onClick={() => copy(issued.webcalUrl)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    En el computador, pega el enlace en «Agregar calendario · Desde URL». En el
                    teléfono, escanea el código y el sistema te ofrece suscribirte.
                  </p>
                </div>

                <div className="flex justify-center rounded-lg border border-input p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL generada por el API, next/image no aporta acá */}
                  <img src={issued.qrDataUrl} alt="Código QR del enlace de suscripción" className="h-40 w-40" />
                </div>
              </>
            ) : status?.active ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-input p-4 text-sm">
                  <p className="font-medium text-foreground">Ya tienes una suscripción activa.</p>
                  <p className="mt-1 text-muted-foreground">
                    Creada el {formatDate(status.createdAt)} · última lectura:{" "}
                    {formatDate(status.lastUsedAt)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    El enlace solo se muestra al generarlo. Si lo perdiste, genera uno nuevo:
                    el anterior deja de funcionar.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={issue} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Regenerar enlace
                  </Button>
                  <Button type="button" variant="destructive" className="gap-2" onClick={revoke} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                    Revocar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Vas a generar un enlace personal. Muestra únicamente los eventos que ya puedes
                  ver en la aplicación, y puedes revocarlo en cualquier momento.
                </p>
                <Button type="button" className="gap-2" onClick={issue} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  Generar mi enlace
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
