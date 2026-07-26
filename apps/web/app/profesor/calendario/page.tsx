"use client"

import { PortalCalendarPage } from "@/components/shared/calendar/portal-calendar-page"

// Sin `invoice` — un profesor no ve cartera, y el backend se lo negaría igual — y sin
// `election`, que tampoco le corresponde. Las entregas sí: son las de las tareas que él puso.
export default function CalendarioProfesorPage() {
  return (
    <PortalCalendarPage
      title="Calendario"
      description="Eventos del colegio, tus entregas y el cierre de periodos"
      sources={["event", "homework", "period"]}
    />
  )
}
