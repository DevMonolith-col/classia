"use client"

import { MessageSquare, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function WorkspaceSupportEmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-background">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6">
        <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-2xl font-semibold tracking-tight">Espacio de Trabajo</h3>
      <p className="mt-2 text-muted-foreground max-w-sm mb-6">
        Selecciona un ticket de la bandeja de la izquierda para ver los detalles y resolver los problemas de los clientes.
      </p>
      <Button variant="outline" asChild>
        <Link href="/superadmin/support/dashboard">
          <Building2 className="h-4 w-4 mr-2" />
          Volver al Centro de Mando
        </Link>
      </Button>
    </div>
  )
}
