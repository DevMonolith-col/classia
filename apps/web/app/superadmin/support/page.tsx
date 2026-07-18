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
  User as UserIcon,
  X,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS } from "@/components/support/ticket-categories"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken } from "@/lib/auth"

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

interface SupportAgent {
  id: string
  firstName: string
  lastName: string
  role: string
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
  const [agents, setAgents] = useState<SupportAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL")
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function fetchTickets() {
      try {
        setLoading(true)
        const [ticketsRes, agentsRes] = await Promise.all([
          apiFetch("/support/tickets", { silent: true }),
          apiFetch("/support/agents", { silent: true }),
        ])
        if (!ticketsRes.ok) throw new Error("Error al cargar los tickets")
        const data = await ticketsRes.json()
        if (!cancelled) setTickets(data)
        if (!cancelled && agentsRes.ok) setAgents(await agentsRes.json())
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTickets()

    // Bandeja global en tiempo real: cualquier ticket nuevo o actualizado de
    // cualquier colegio debe reflejarse aquí sin recargar la página.
    const token = getAccessToken()
    let newSocket: Socket | undefined
    if (token) {
      newSocket = io(`${API_URL}/support`, {
        auth: { token },
        transports: ["websocket"],
      })
      newSocket.on("connect", () => newSocket?.emit("dashboard:join"))
      newSocket.on("ticket:created", () => fetchTickets())
      newSocket.on("ticket:updated", () => fetchTickets())
    }

    return () => {
      cancelled = true
      newSocket?.emit("dashboard:leave")
      newSocket?.disconnect()
    }
  }, [])

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false
    if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false
    if (assigneeFilter !== "ALL" && (assigneeFilter === "UNASSIGNED" ? t.assignee : t.assignee?.id !== assigneeFilter)) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.tenant?.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter, assigneeFilter, search])

  const hasActiveFilters = statusFilter !== "ALL" || categoryFilter !== "ALL" || assigneeFilter !== "ALL" || search !== ""

  function clearFilters() {
    setStatusFilter("ALL")
    setCategoryFilter("ALL")
    setAssigneeFilter("ALL")
    setSearch("")
  }

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
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar ticket o colegio..."
                  className="pl-9 bg-background"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
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
            <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-end">
              <div className="w-full space-y-1.5 sm:w-56">
                <Label className="text-xs">Categoría</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las categorías</SelectItem>
                    {TICKET_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{TICKET_CATEGORY_LABELS[category]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-1.5 sm:w-56">
                <Label className="text-xs">Resuelto por</Label>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Cualquiera</SelectItem>
                    <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="gap-1.5 sm:ml-auto" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" />
                  Eliminar filtros
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
