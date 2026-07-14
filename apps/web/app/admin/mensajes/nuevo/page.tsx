"use client"

import Link from "next/link"
import { ArrowLeft, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function NuevoMensajePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="mb-4 gap-1" asChild>
        <Link href="/admin/mensajes">
          <ArrowLeft className="h-4 w-4" />
          Volver a Mensajes
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Próximamente</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Enviar mensajes nuevos estará disponible cuando se conecte el módulo de mensajería,
            que otro equipo del proyecto está construyendo.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
