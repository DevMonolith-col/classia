"use client"

import { useState, useEffect } from "react"
import {
  LifeBuoy,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
  AlertTriangle,
  MessageSquare,
  User as UserIcon
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED"
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

interface SupportTicket {
  id: string
  tenantId: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  category: string
  createdAt: string
  updatedAt: string
  tenant?: { name: string; slug: string }
  assignee?: {
    id: string
    firstName: string
    lastName: string
  }
  _count?: { comments: number }
}

const statusConfig: Record<TicketStatus, { label: string, color: string, icon: any }> = {
  OPEN: { label: "Abierto", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Esperando al cliente", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200", icon: User },
  RESOLVED: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200", icon: XCircle },
}

const priorityConfig: Record<TicketPriority, { label: string, color: string }> = {
  LOW: { label: "Baja", color: "text-slate-500" },
  MEDIUM: { label: "Media", color: "text-blue-500" },
  HIGH: { label: "Alta", color: "text-amber-500" },
  CRITICAL: { label: "Crítica", color: "text-red-500 font-bold" },
}

const PAGE_SIZE = 10

export default function SuperAdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL")
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "ALL">("ALL")
  const [page, setPage] = useState(1)

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

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false
    if (priorityFilter !== "ALL" && t.priority !== priorityFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.tenant?.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, priorityFilter, search])

  // Calculate metrics
  const openCount = tickets.filter(t => t.status === "OPEN").length
  const criticalCount = tickets.filter(t => t.priority === "CRITICAL" && t.status !== "RESOLVED" && t.status !== "CLOSED").length

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Centro de Control Escolar</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            Soporte B2B
          </h1>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">

        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <CardTitle>Bandeja de Entrada Global</CardTitle>
                <CardDescription>Gestiona las peticiones de todos los colegios de la plataforma.</CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ticket o colegio..."
                  className="pl-9 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="flex h-10 w-full sm:w-[150px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
              >
                <option value="ALL">Prioridad: Todas</option>
                <option value="CRITICAL">Crítica</option>
                <option value="HIGH">Alta</option>
                <option value="MEDIUM">Media</option>
                <option value="LOW">Baja</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setStatusFilter("ALL")} className={statusFilter === "ALL" ? "bg-secondary" : ""}>
                Todos
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStatusFilter("OPEN")} className={statusFilter === "OPEN" ? "bg-blue-100 text-blue-800" : ""}>
                Abiertos ({openCount})
              </Button>
              {criticalCount > 0 && (
                <Button variant="destructive" size="sm">
                  Críticos ({criticalCount})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-destructive flex flex-col items-center gap-2">
                <AlertTriangle className="h-8 w-8" />
                <p>{error}</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                <h3 className="text-lg font-medium">¡Bandeja al día!</h3>
                <p className="text-muted-foreground mt-1">No hay tickets que coincidan con la búsqueda actual.</p>
              </div>
            ) : (
              <>
              <div className="divide-y divide-border">
                {paginatedTickets.map(ticket => {
                  const status = statusConfig[ticket.status]
                  const priority = priorityConfig[ticket.priority]
                  const StatusIcon = status.icon
                  const date = new Date(ticket.updatedAt).toLocaleDateString("es-CO", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  
                  return (
                    <div key={ticket.id} className="p-4 hover:bg-secondary/30 transition-colors flex flex-col sm:flex-row gap-4 sm:items-center justify-between group">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${ticket.priority === 'CRITICAL' ? 'bg-red-500 animate-pulse' : 'bg-transparent'}`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`${status.color}`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            <span className="text-xs font-mono text-muted-foreground">#{ticket.id.split('-')[0].toUpperCase()}</span>
                            <span className={`text-xs ${priority.color}`}>Prioridad {priority.label}</span>
                          </div>
                          <Link href={`/superadmin/support/${ticket.id}`} className="font-semibold text-base hover:underline line-clamp-1">
                            {ticket.title}
                          </Link>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {ticket.tenant?.name ?? 'Colegio Desconocido'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Actualizado: {date}
                            </span>
                            {ticket._count && ticket._count.comments > 0 && (
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {ticket._count.comments}
                              </span>
                            )}
                            {ticket.assignee && (
                              <span className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 rounded-sm">
                                <UserIcon className="h-3 w-3" />
                                {ticket.assignee.firstName} {ticket.assignee.lastName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" asChild>
                        <Link href={`/superadmin/support/${ticket.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  )
                })}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between border-t border-border p-4">
                  <p className="text-sm text-muted-foreground">
                    Página {currentPage} de {pageCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                      disabled={currentPage >= pageCount}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
