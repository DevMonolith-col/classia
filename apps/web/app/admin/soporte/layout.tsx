"use client"

import { TicketSidebar } from "@/components/support/TicketSidebar"
import { useParams } from "next/navigation"

export default function TenantSupportLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams() as { id?: string }

  // Si estamos en /admin/soporte/nuevo, no mostramos el sidebar.
  // Pero useParams solo devuelve parámetros de ruta dinámica, por lo que para 'nuevo', 
  // id es undefined, pero la URL es /admin/soporte/nuevo.
  // Vamos a usar un chequeo simple en el lado del cliente (si es necesario).
  // Para Next.js app router, si estamos en /admin/soporte/nuevo, podemos verificar window.location.pathname
  // Pero un enfoque más simple es que 'nuevo' no tenga el layout (aunque sí lo hereda).
  // Si queremos que 'nuevo' no tenga el layout, deberíamos sacarlo.
  // Pero la Sidebar está bien para crear un nuevo ticket también.

  return (
    <div className="p-4 lg:p-6 h-[calc(100vh-4rem)] lg:h-screen">
      <div className="flex h-full w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className={`w-full sm:w-[350px] lg:w-[400px] shrink-0 border-r border-border h-full ${id ? 'hidden sm:block' : 'block'}`}>
          <TicketSidebar basePath="/admin/soporte" isTenant={true} />
        </div>
        <div className={`flex-1 min-w-0 h-full bg-background relative ${!id ? 'hidden sm:flex' : 'flex'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
