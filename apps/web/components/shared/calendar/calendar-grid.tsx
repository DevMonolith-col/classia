"use client"

// Grilla mes/semana del calendario, sin ninguna fuente de datos propia.
//
// Se extrajo de app/admin/calendario/page.tsx el 2026-07-26. Es requisito del plan y no una
// mejora: profesor/horario y familia/horario ya duplican ~70% de su calendario entre sí
// (frontend-unificacion-roles.md), y las fases 4-5 agregan /familia/calendario,
// /profesor/calendario y /alumno/calendario. Sin esto la duplicación pasaba de 2 a 5 copias.
//
// El componente no sabe de permisos ni de API: recibe eventos y devuelve clics. Quién puede
// crear o editar lo decide la página que lo usa.

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  type CalendarEvent,
  EVENT_TYPE_COLORS,
  formatEventTime,
  groupEventsByDay,
  localDateKey,
} from "./calendar-types"

export type CalendarViewMode = "month" | "week"

const WEEK_DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

interface CalendarGridProps {
  events: CalendarEvent[]
  currentDate: Date
  viewMode: CalendarViewMode
  onCurrentDateChange: (date: Date) => void
  onViewModeChange: (mode: CalendarViewMode) => void
  onSelectEvent: (event: CalendarEvent) => void
  /** Se dispara al hacer clic en un día vacío. Sin esto, los días no son clicables. */
  onSelectDay?: (date: Date) => void
  loading?: boolean
}

export function monthRange(date: Date): { from: Date; to: Date } {
  // Se pide el mes completo más un margen de una semana a cada lado: la grilla mensual
  // muestra días del mes anterior y del siguiente en la primera y última fila.
  const from = new Date(date.getFullYear(), date.getMonth(), 1)
  from.setDate(from.getDate() - 7)
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  to.setDate(to.getDate() + 7)
  to.setHours(23, 59, 59, 999)
  return { from, to }
}

export function CalendarGrid({
  events,
  currentDate,
  viewMode,
  onCurrentDateChange,
  onViewModeChange,
  onSelectEvent,
  onSelectDay,
  loading = false,
}: CalendarGridProps) {
  const byDay = groupEventsByDay(events)
  // "Hoy" se calcula de verdad. La versión mock comparaba `day === 12 && month === 1`, así
  // que el resaltado apuntaba al 12 de febrero para siempre.
  const todayKey = localDateKey(new Date())

  function navigate(direction: "prev" | "next") {
    const next = new Date(currentDate)
    if (viewMode === "month") {
      // Al día 1 antes de mover el mes: si hoy es 31 y el mes destino tiene 30, JS desborda
      // al mes siguiente y "anterior" salta dos meses.
      next.setDate(1)
      next.setMonth(currentDate.getMonth() + (direction === "next" ? 1 : -1))
    } else {
      next.setDate(currentDate.getDate() + (direction === "next" ? 7 : -7))
    }
    onCurrentDateChange(next)
  }

  function monthCells(date: Date): Array<Date | null> {
    const year = date.getFullYear()
    const month = date.getMonth()
    const startingDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: Array<Date | null> = []
    for (let i = 0; i < startingDay; i++) cells.push(null)
    for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day))
    return cells
  }

  function weekDates(date: Date): Date[] {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }

  const heading =
    viewMode === "month"
      ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : (() => {
          const week = weekDates(currentDate)
          const first = week[0]
          const last = week[6]
          return first.getMonth() === last.getMonth()
            ? `${first.getDate()} – ${last.getDate()} de ${MONTHS[first.getMonth()]} ${first.getFullYear()}`
            : `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
        })()

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onCurrentDateChange(new Date())}>
                Hoy
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={viewMode === "month" ? "Mes anterior" : "Semana anterior"}
                onClick={() => navigate("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={viewMode === "month" ? "Mes siguiente" : "Semana siguiente"}
                onClick={() => navigate("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
              {loading && <span className="text-xs text-muted-foreground">Cargando…</span>}
            </div>
            <div className="flex rounded-lg border border-input p-1">
              {(["month", "week"] as CalendarViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onViewModeChange(mode)}
                >
                  {mode === "month" ? "Mes" : "Semana"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {viewMode === "month" && (
        <Card>
          <CardContent className="p-2 lg:p-4">
            <div className="grid grid-cols-7 gap-px bg-border">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground lg:text-sm"
                >
                  <span className="hidden lg:inline">{day}</span>
                  <span className="lg:hidden">{day.charAt(0)}</span>
                </div>
              ))}
              {monthCells(currentDate).map((cellDate, index) => {
                if (!cellDate) {
                  return <div key={`empty-${index}`} className="min-h-20 bg-muted/50 lg:min-h-28" />
                }
                const key = localDateKey(cellDate)
                const dayEvents = byDay.get(key) ?? []
                const isToday = key === todayKey

                return (
                  <div
                    key={key}
                    className={`min-h-20 bg-background p-1 lg:min-h-28 ${onSelectDay ? "cursor-pointer transition-colors hover:bg-muted/50" : ""}`}
                    onClick={onSelectDay ? () => onSelectDay(cellDate) : undefined}
                  >
                    <p
                      className={`mb-1 text-xs lg:text-sm ${
                        isToday
                          ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground lg:h-6 lg:w-6"
                          : "text-foreground"
                      }`}
                    >
                      {cellDate.getDate()}
                    </p>
                    <div className="space-y-0.5 lg:space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectEvent(event)
                          }}
                          className={`hidden w-full truncate rounded px-1 py-0.5 text-left text-xs text-white lg:block ${EVENT_TYPE_COLORS[event.type]}`}
                          title={event.title}
                        >
                          {event.title}
                        </button>
                      ))}
                      {/* El indicador sigue siendo un punto de 6px, pero el área activa
                          es el botón que lo contiene: 44px de alto y un reparto por
                          `flex-1` del ancho de la celda. Antes el <button> medía 6×6px. */}
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 lg:hidden">
                          {dayEvents.slice(0, 3).map((event) => (
                            <button
                              key={event.id}
                              aria-label={event.title}
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectEvent(event)
                              }}
                              className="flex h-11 flex-1 items-center justify-center"
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_COLORS[event.type]}`}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                      {dayEvents.length > 2 && (
                        <p className="hidden text-xs text-muted-foreground lg:block">
                          +{dayEvents.length - 2} más
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === "week" && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {weekDates(currentDate).map((date, index) => {
                const key = localDateKey(date)
                const dayEvents = byDay.get(key) ?? []
                const isToday = key === todayKey

                return (
                  <div key={key} className="flex gap-4">
                    <button
                      type="button"
                      onClick={onSelectDay ? () => onSelectDay(date) : undefined}
                      disabled={!onSelectDay}
                      className={`flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg ${
                        isToday ? "bg-primary text-primary-foreground" : "bg-muted"
                      } ${onSelectDay ? "transition-opacity hover:opacity-80" : ""}`}
                    >
                      <span className="text-xs">{WEEK_DAYS[index]}</span>
                      <span className="text-lg font-bold">{date.getDate()}</span>
                    </button>
                    <div className="flex-1 space-y-2">
                      {dayEvents.length > 0 ? (
                        dayEvents.map((event) => (
                          <button
                            key={event.id}
                            onClick={() => onSelectEvent(event)}
                            className={`flex w-full items-center gap-3 rounded-lg p-3 text-left text-white ${EVENT_TYPE_COLORS[event.type]}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium">{event.title}</p>
                              <p className="truncate text-sm opacity-80">
                                {event.allDay ? "Todo el día" : formatEventTime(event)}
                                {event.location ? ` · ${event.location}` : ""}
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="flex h-14 items-center rounded-lg border border-dashed border-input px-3">
                          <p className="text-sm text-muted-foreground">Sin eventos</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
