"use client"

// Página de calendario de los portales de familia, profesor y alumno (Fase 4).
//
// Las tres son la misma pantalla con distintas fuentes por defecto, así que viven acá y cada
// ruta es un envoltorio de diez líneas. Es lo que el componente compartido de la Fase 2 existía
// para permitir: sin él, esto habrían sido tres copias de la grilla.
//
// A diferencia de /admin/calendario, acá **no se crea ni se edita nada**: estos portales
// consumen el calendario agregado, donde todo lo derivado es de solo lectura y el clic lleva al
// módulo dueño (§2.D del plan).

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar as CalendarIcon, CalendarPlus, Clock, ExternalLink, Loader2, MapPin } from "lucide-react"
import Link from "next/link"
import { ApiError, apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarGrid, monthRange, type CalendarViewMode } from "./calendar-grid"
import { CalendarSubscribeDialog } from "./subscribe-dialog"
import {
  type CalendarEvent,
  type CalendarEventType,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  formatEventRange,
} from "./calendar-types"

export type CalendarSource = "event" | "homework" | "period" | "invoice" | "election" | "schedule"

type CalendarItem = {
  id: string
  source: CalendarSource
  sourceId: string
  title: string
  description?: string | null
  startsAt: string
  endsAt: string
  allDay: boolean
  location?: string | null
  editable: boolean
  href: string
  type?: CalendarEventType
}

const SOURCE_LABELS: Record<CalendarSource, string> = {
  event: "Evento",
  homework: "Entrega",
  period: "Periodo académico",
  invoice: "Vencimiento de pago",
  election: "Votación",
  schedule: "Clase",
}

/**
 * Color por fuente. Los eventos conservan el color de su tipo para que se vean igual que en el
 * panel del colegio; el resto se distingue por fuente.
 */
const SOURCE_TYPE: Record<CalendarSource, CalendarEventType> = {
  event: "INSTITUCIONAL",
  homework: "ACADEMICO",
  period: "ACADEMICO",
  invoice: "ADMINISTRATIVO",
  election: "INSTITUCIONAL",
  schedule: "ACADEMICO",
}

/** La grilla habla el lenguaje de `CalendarEvent`; el agregado trae ítems de seis fuentes. */
function toGridEvent(item: CalendarItem): CalendarEvent {
  return {
    id: item.id,
    tenantId: "",
    title: item.title,
    description: item.description,
    type: item.type ?? SOURCE_TYPE[item.source],
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    allDay: item.allDay,
    location: item.location,
    isSchoolDayOff: false,
    createdAt: item.startsAt,
    updatedAt: item.startsAt,
  }
}

function rangeForView(date: Date, viewMode: CalendarViewMode) {
  if (viewMode === "month") return monthRange(date)
  const from = new Date(date)
  from.setDate(date.getDate() - date.getDay() - 1)
  const to = new Date(from)
  to.setDate(from.getDate() + 9)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

interface Props {
  title: string
  description: string
  /** Fuentes por defecto del portal. Las clases se piden solo donde tienen sentido. */
  sources: CalendarSource[]
}

export function PortalCalendarPage({ title, description, sources }: Props) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month")
  const [items, setItems] = useState<CalendarItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<CalendarItem | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)

  const { from, to } = useMemo(() => rangeForView(currentDate, viewMode), [currentDate, viewMode])
  const rangeKey = `${from.toISOString()}|${to.toISOString()}`
  const sourcesKey = sources.join(",")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [fromIso, toIso] = rangeKey.split("|")
      const res = await apiFetch(
        `/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&sources=${sourcesKey}`,
        { silent: true },
      )
      if (!res.ok) throw new Error("No se pudo cargar el calendario.")
      setItems((await res.json()) as CalendarItem[])
    } catch (err) {
      if (err instanceof ApiError) setError("No se pudo conectar con el servidor.")
      else setError(err instanceof Error ? err.message : "No se pudo cargar el calendario.")
    } finally {
      setLoading(false)
    }
  }, [rangeKey, sourcesKey])

  useEffect(() => {
    load()
  }, [load])

  const gridEvents = useMemo(() => items.map(toGridEvent), [items])
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="px-4 py-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">{title}</h1>
              <p className="mt-1 text-muted-foreground">{description}</p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => setSubscribeOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              Suscribir a mi calendario
            </Button>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="flex-1">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>
                Reintentar
              </Button>
            </div>
          )}

          <CalendarGrid
            events={gridEvents}
            currentDate={currentDate}
            viewMode={viewMode}
            onCurrentDateChange={setCurrentDate}
            onViewModeChange={setViewMode}
            onSelectEvent={(event) => setSelected(byId.get(event.id) ?? null)}
            loading={loading}
          />

          {!loading && !error && items.length === 0 && (
            <Card className="mt-6">
              <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
                <CalendarIcon className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium text-foreground">No hay nada en este rango</p>
                <p className="text-sm text-muted-foreground">
                  Cuando el colegio publique eventos o se acerque una entrega, aparecen acá.
                </p>
              </CardContent>
            </Card>
          )}

          {loading && items.length === 0 && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando el calendario…
            </div>
          )}
        </div>
      </main>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={() => setSelected(null)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div
              className={`rounded-t-lg p-4 text-white ${EVENT_TYPE_COLORS[selected.type ?? SOURCE_TYPE[selected.source]]}`}
            >
              <p className="text-sm opacity-80">
                {SOURCE_LABELS[selected.source]}
                {selected.source === "event" && selected.type
                  ? ` · ${EVENT_TYPE_LABELS[selected.type]}`
                  : ""}
              </p>
              <p className="text-lg font-semibold">{selected.title}</p>
            </div>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <CalendarIcon className="h-5 w-5 shrink-0" />
                <span>
                  {new Date(selected.startsAt).toLocaleDateString("es-CO", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <Clock className="h-5 w-5 shrink-0" />
                <span>
                  {formatEventRange({
                    ...toGridEvent(selected),
                  })}
                </span>
              </div>
              {selected.location && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 shrink-0" />
                  <span>{selected.location}</span>
                </div>
              )}
              {selected.description && (
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              )}

              <div className="flex gap-2 pt-2">
                {/* Todo lo derivado se edita en su módulo, nunca acá. */}
                {selected.source !== "event" && (
                  <Button variant="outline" className="flex-1 gap-2" asChild>
                    <Link href={selected.href}>
                      <ExternalLink className="h-4 w-4" />
                      Ver detalle
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" className="flex-1" onClick={() => setSelected(null)}>
                  Cerrar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <CalendarSubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
    </div>
  )
}
