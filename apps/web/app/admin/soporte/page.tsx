"use client"

import { useState, useEffect } from "react"
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED"
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

interface SupportTicket {
  id: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  category: string
  createdAt: string
  updatedAt: string
  _count?: { comments: number }
}

const statusConfig: Record<TicketStatus, { label: string, color: string, icon: any }> = {
  OPEN: { label: "Abierto", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Respuesta requerida", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200", icon: MessageSquare },
  RESOLVED: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200", icon: XCircle },
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function fetchTickets() {
      try {
        setLoading(true)
        const res = await apiFetch("/support/tickets")
        if (!res.ok) throw new Error("Error al cargar los tickets")
        const data = await res.json()
        if (!cancelled) setTickets(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTickets()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centro de Control Escolar</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Soporte y Ayuda</h1>
          </div>
          <Button size="sm" asChild className="gap-1.5">
            <Link href="/admin/soporte/nuevo">
              <Plus className="h-3.5 w-3.5" />
              Nuevo Ticket
            </Link>
          </Button>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 lg:px-8 space-y-6">

      <Card>
        <CardHeader>
          <CardTitle>Mis Tickets Activos</CardTitle>
          <CardDescription>Historial de solicitudes de soporte de tu institución.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-destructive">{error}</div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center border-t border-border">
              <LifeBuoy className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-medium">No tienes tickets de soporte</h3>
              <p className="text-muted-foreground mt-1">Si presentas algún problema, crea un nuevo ticket y nuestro equipo te ayudará pronto.</p>
              <Button variant="outline" className="mt-4 gap-2" asChild>
                <Link href="/admin/soporte/nuevo">
                  <Plus className="h-4 w-4" /> Crear mi primer ticket
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border border-t">
              {tickets.map(ticket => {
                const status = statusConfig[ticket.status]
                const StatusIcon = status.icon
                const date = new Date(ticket.updatedAt).toLocaleDateString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                
                return (
                  <div key={ticket.id} className="p-4 hover:bg-secondary/30 transition-colors flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`${status.color}`}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">#{ticket.id.split('-')[0].toUpperCase()}</span>
                      </div>
                      <Link href={`/admin/soporte/${ticket.id}`} className="font-semibold text-base hover:underline text-primary">
                        {ticket.title}
                      </Link>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Actualizado: {date}
                        </span>
                        {ticket._count && ticket._count.comments > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {ticket._count.comments} respuestas
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" asChild>
                      <Link href={`/admin/soporte/${ticket.id}`}>Ver detalle</Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  </div>
  )
}
