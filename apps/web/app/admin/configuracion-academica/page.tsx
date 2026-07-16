"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, Loader2, Lock, LockOpen, RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Period = {
  id: string
  name: string
  sequence: number
  weight: number
  lockedAt: string | null
}
type AcademicYear = {
  id: string
  name: string
  status: string
  isActive: boolean
  periods: Period[]
}
type Band = { id: string; label: string; minValue: number; maxValue: number }
type Scale = {
  id: string
  name: string
  minValue: number
  maxValue: number
  passingValue: number
  isDefault: boolean
  bands: Band[]
}

export default function ConfiguracionAcademicaPage() {
  const [year, setYear] = useState<AcademicYear | null>(null)
  const [scale, setScale] = useState<Scale | null>(null)
  const [drafts, setDrafts] = useState<{ name: string; weight: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [yearsRes, scalesRes] = await Promise.all([
        apiFetch("/academic-years", { silent: true }),
        apiFetch("/grading-scales", { silent: true }),
      ])
      if (!yearsRes.ok) throw new Error("No se pudo cargar el año académico.")
      const years = (await yearsRes.json()) as AcademicYear[]
      const active = years.find((y) => y.isActive) ?? years[0] ?? null
      setYear(active)
      setDrafts((active?.periods ?? []).map((p) => ({ name: p.name, weight: String(p.weight) })))
      const scales = scalesRes.ok ? ((await scalesRes.json()) as Scale[]) : []
      setScale(scales.find((s) => s.isDefault) ?? scales[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const weightSum = drafts.reduce((s, d) => s + (Number(d.weight) || 0), 0)
  const anyLocked = (year?.periods ?? []).some((p) => p.lockedAt)

  async function savePeriods() {
    if (!year) return
    if (Math.abs(weightSum - 100) > 0.01) {
      toast.error("Los pesos deben sumar 100%.")
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch(`/academic-years/${year.id}/periods`, {
        method: "POST",
        body: JSON.stringify({
          periods: drafts.map((d, i) => ({ name: d.name, sequence: i + 1, weight: Number(d.weight) })),
        }),
        silent: true,
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const m = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(m || "No se pudieron guardar los periodos.")
      }
      toast.success("Periodos guardados")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setSaving(false)
    }
  }

  async function toggleLock(period: Period) {
    const action = period.lockedAt ? "unlock" : "lock"
    const res = await apiFetch(`/academic-periods/${period.id}/${action}`, { method: "POST", silent: true })
    if (!res.ok) {
      toast.error("No se pudo cambiar el estado del periodo.")
      return
    }
    toast.success(period.lockedAt ? "Periodo reabierto" : "Periodo cerrado")
    await load()
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Configuración Académica</h1>
          <p className="mt-1 text-muted-foreground">Periodos del año, sus pesos, y la escala de calificación del colegio.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-lg bg-secondary" />
      ) : !year ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay un año académico configurado todavía.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border">
              <CardTitle className="flex items-center gap-2">
                Periodos · Año {year.name}
                {year.isActive && <Badge variant="outline">Activo</Badge>}
              </CardTitle>
              <span className={`text-sm ${Math.abs(weightSum - 100) < 0.01 ? "text-muted-foreground" : "text-amber-600"}`}>
                Suma de pesos: {weightSum}%
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {anyLocked && (
                <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Hay periodos cerrados. Reábrelos para poder reconfigurar los pesos.
                </p>
              )}
              {drafts.map((d, i) => {
                const period = year.periods[i]
                const locked = Boolean(period?.lockedAt)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 text-sm text-muted-foreground">{i + 1}</span>
                    <Input
                      value={d.name}
                      disabled={anyLocked}
                      onChange={(e) => setDrafts((c) => c.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                      className="flex-1"
                    />
                    <div className="relative w-24">
                      <Input
                        type="number"
                        value={d.weight}
                        disabled={anyLocked}
                        onChange={(e) => setDrafts((c) => c.map((x, idx) => (idx === i ? { ...x, weight: e.target.value } : x)))}
                        className="pr-6 text-right"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                    {period && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title={locked ? "Reabrir periodo" : "Cerrar periodo"}
                        onClick={() => toggleLock(period)}
                      >
                        {locked ? <Lock className="h-4 w-4 text-amber-600" /> : <LockOpen className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    )}
                  </div>
                )
              })}
              <div className="flex justify-end pt-2">
                <Button onClick={savePeriods} disabled={saving || anyLocked} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar periodos
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border">
              <CardTitle>Escala de calificación</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {!scale ? (
                <p className="text-sm text-muted-foreground">No hay escala configurada.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-foreground">{scale.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Rango {scale.minValue}–{scale.maxValue} · aprueba {scale.passingValue}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {scale.bands.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span className="font-medium text-foreground">{b.label}</span>
                        <span className="text-muted-foreground">
                          {b.minValue} – {b.maxValue}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
