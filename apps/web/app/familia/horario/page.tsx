import { PortalSchedulePage } from "@/components/shared/schedule/portal-schedule-page"

export default function HorarioFamiliaPage() {
  return (
    <PortalSchedulePage
      title="Horario de Clases"
      description="Horario semanal de tus hijos"
      secondary="teacher"
      withStudentPicker
    />
  )
}
