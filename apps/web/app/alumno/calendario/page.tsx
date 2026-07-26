"use client"

import { PortalCalendarPage } from "@/components/shared/calendar/portal-calendar-page"

// El alumno ve sus entregas y las votaciones en las que participa. Cartera queda fuera a
// propósito: la deuda es conversación de la familia con el colegio, no del estudiante.
export default function CalendarioAlumnoPage() {
  return (
    <PortalCalendarPage
      title="Mi calendario"
      description="Tus entregas, los eventos del colegio y las fechas del periodo"
      sources={["event", "homework", "period", "election"]}
    />
  )
}
