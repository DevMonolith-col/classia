"use client"

import { PortalCalendarPage } from "@/components/shared/calendar/portal-calendar-page"

// Sin `schedule`: el horario de clases del hijo satura la grilla mensual y la familia lo
// consulta en /familia/horario, no acá. Sí van los vencimientos de cartera, que el backend
// acota a las facturas de sus propios hijos.
export default function CalendarioFamiliaPage() {
  return (
    <PortalCalendarPage
      title="Calendario"
      description="Eventos del colegio, entregas de tus hijos y fechas importantes"
      sources={["event", "homework", "period", "invoice", "election"]}
    />
  )
}
