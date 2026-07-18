"use client"

import { MessageSquare, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function TenantSupportEmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-background">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6">
        <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-2xl font-semibold tracking-tight">Soporte y Ayuda</h3>
      <p className="mt-2 text-muted-foreground max-w-sm mb-6">
        Selecciona un ticket de la bandeja de la izquierda para ver los detalles, o crea un nuevo ticket si tienes un problema.
      </p>
      <Button asChild className="gap-2">
        <Link href="/admin/soporte/nuevo">
          <Plus className="h-4 w-4" /> Crear Ticket
        </Link>
      </Button>
    </div>
  )
}
