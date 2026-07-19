"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
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
  Lock,
  Send,
  Shield,
  Briefcase,
  Check,
  ChevronsUpDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { apiFetch } from "@/lib/api-client"
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS } from "@/components/support/ticket-categories"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken } from "@/lib/auth"
import { attachTokenRefresh } from "@/lib/socket"

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

function TriageContent() {
  const searchParams = useSearchParams()
  const initialTenantId = searchParams.get("tenantId")
  const initialAssigneeId = searchParams.get("assigneeId")

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [agents, setAgents] = useState<SupportAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  
  // Filtros
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [assigneeFilter, setAssigneeFilter] = useState<string>(initialAssigneeId || "ALL")
  const [tenantFilter, setTenantFilter] = useState<string>(initialTenantId || "ALL")
  
  const [page, setPage] = useState(1)

  // Triage state
  const [triageTicket, setTriageTicket] = useState<SupportTicket | null>(null)
  const [triageNote, setTriageNote] = useState("")
  const [triageAgentId, setTriageAgentId] = useState<string | null>(null)
  const [isSubmittingTriage, setIsSubmittingTriage] = useState(false)
  const [agentComboboxOpen, setAgentComboboxOpen] = useState(false)

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

    const token = getAccessToken()
    let newSocket: Socket | undefined
    if (token) {
      newSocket = io(`${API_URL}/support`, {
        auth: { token },
        transports: ["websocket"],
      })
      attachTokenRefresh(newSocket)
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

  const activeTickets = tickets.filter(t => t.status !== "RESOLVED" && t.status !== "CLOSED")
  const tenantMap = new Map<string, { id: string, name: string }>()
  activeTickets.forEach(t => {
    if (t.tenant && !tenantMap.has(t.tenantId)) {
      tenantMap.set(t.tenantId, { id: t.tenantId, name: t.tenant.name })
    }
  })

  const agentMap = new Map<string, { agent: SupportAgent, count: number }>()
  agents.forEach(a => agentMap.set(a.id, { agent: a, count: 0 }))
  activeTickets.forEach(t => {
    if (t.assignee) {
      const existing = agentMap.get(t.assignee.id)
      if (existing) existing.count++
    }
  })
  const agentLoads = Array.from(agentMap.values()).sort((a, b) => b.count - a.count)

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false
    if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false
    if (assigneeFilter !== "ALL" && (assigneeFilter === "UNASSIGNED" ? t.assignee : t.assignee?.id !== assigneeFilter)) return false
    if (tenantFilter !== "ALL" && t.tenantId !== tenantFilter) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.tenant?.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginatedTickets = filteredTickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter, assigneeFilter, search, tenantFilter])

  const hasActiveFilters = statusFilter !== "ALL" || categoryFilter !== "ALL" || assigneeFilter !== "ALL" || tenantFilter !== "ALL" || search !== ""

  function clearFilters() {
    setStatusFilter("ALL")
    setCategoryFilter("ALL")
    setAssigneeFilter("ALL")
    setTenantFilter("ALL")
    setSearch("")
  }

  async function handleTriageSubmit() {
    if (!triageTicket || !triageAgentId) return
    setIsSubmittingTriage(true)
    try {
      await apiFetch(`/support/tickets/${triageTicket.id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeId: triageAgentId })
      })
      if (triageNote.trim()) {
        await apiFetch(`/support/tickets/${triageTicket.id}/comments`, {
          method: "POST",
          body: JSON.stringify({ content: triageNote, isInternal: true })
        })
      }
      setTriageTicket(null)
      setTriageNote("")
      setTriageAgentId(null)
    } catch (e) {
      console.error(e)
    } finally {
      setIsSubmittingTriage(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Flujo Operativo</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <LifeBuoy className="h-6 w-6 text-primary" />
              Cola de Triage
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/superadmin/support/dashboard">
                <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                Volver al Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-border bg-muted/30">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div>
                <CardTitle>Bandeja de Entrada Global</CardTitle>
                <CardDescription>Filtra, busca y asigna los tickets de todos los colegios.</CardDescription>
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
            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-end flex-wrap">
              <div className="w-full space-y-1.5 flex-1 min-w-[160px]">
                <Label className="text-xs font-medium text-muted-foreground">Estado</Label>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="h-9 w-full bg-background transition-colors hover:bg-secondary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los estados</SelectItem>
                    <SelectItem value="OPEN">Abierto</SelectItem>
                    <SelectItem value="IN_PROGRESS">En progreso</SelectItem>
                    <SelectItem value="WAITING_ON_CUSTOMER">Esperando cliente</SelectItem>
                    <SelectItem value="RESOLVED">Resuelto</SelectItem>
                    <SelectItem value="CLOSED">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-1.5 flex-1 min-w-[160px]">
                <Label className="text-xs font-medium text-muted-foreground">Categoría</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9 w-full bg-background transition-colors hover:bg-secondary/20">
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
              <div className="w-full space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-xs font-medium text-muted-foreground">Colegio</Label>
                <Select value={tenantFilter} onValueChange={setTenantFilter}>
                  <SelectTrigger className="h-9 w-full line-clamp-1 bg-background transition-colors hover:bg-secondary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Cualquier colegio</SelectItem>
                    {Array.from(tenantMap.values()).map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>{tenant.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full space-y-1.5 flex-1 min-w-[160px]">
                <Label className="text-xs font-medium text-muted-foreground">Agente</Label>
                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="h-9 w-full line-clamp-1 bg-background transition-colors hover:bg-secondary/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Cualquier agente</SelectItem>
                    <SelectItem value="UNASSIGNED">Sin asignar</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.firstName} {agent.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <div className="w-full sm:w-auto">
                  <Button variant="ghost" size="sm" className="h-9 w-full gap-1.5 sm:px-4 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={clearFilters}>
                    <X className="h-3.5 w-3.5" />
                    Limpiar
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-destructive flex flex-col items-center gap-2">
                <AlertTriangle className="h-8 w-8" />
                <p>{error}</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3" />
                <h3 className="text-lg font-medium">Bandeja despejada</h3>
                <p className="text-muted-foreground mt-1 text-sm">No hay tickets que coincidan con la vista actual.</p>
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
                          <Link href={`/superadmin/support/inbox/${ticket.id}`} className="font-semibold text-base hover:underline line-clamp-1">
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
                            {ticket.assignee ? (
                              <span className="flex items-center gap-1 text-primary bg-primary/10 px-1.5 rounded-sm">
                                <UserIcon className="h-3 w-3" />
                                {ticket.assignee.firstName} {ticket.assignee.lastName}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600 bg-amber-500/10 px-1.5 rounded-sm font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                Sin asignar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" className="shrink-0" onClick={() => {
                        setTriageTicket(ticket)
                        setTriageAgentId(ticket.assignee?.id ?? null)
                      }}>
                        Despachar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
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

      <Sheet open={!!triageTicket} onOpenChange={(open) => {
        if (!open) {
          setTriageTicket(null)
          setTriageNote("")
          setTriageAgentId(null)
        }
      }}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto p-0 flex flex-col border-l-0 shadow-2xl">
          <SheetHeader className="sr-only">
            <SheetTitle>Triage de Soporte</SheetTitle>
          </SheetHeader>
          {/* FIX COLOR HERE: bg-sidebar text-sidebar-foreground border-sidebar-border */}
          <div className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border p-6 pb-8 relative">
            <div className="absolute top-4 right-4">
              <Button variant="ghost" size="icon" className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-full" onClick={() => setTriageTicket(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-sidebar-primary" />
              <h2 className="font-semibold text-lg tracking-tight">Triage de Soporte</h2>
            </div>
            <p className="text-sm text-sidebar-foreground/70">
              Asigna responsable y define la línea de atención para este ticket.
            </p>
          </div>
          
          {triageTicket && (
            <div className="px-6 pb-6 flex-1 flex flex-col gap-6 -mt-4">
              {/* Contexto del Ticket */}
              <div className="bg-background rounded-xl p-4 shadow-sm border border-border/60 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{triageTicket.tenant?.name}</span>
                  </div>
                  <Badge variant="outline" className={`${priorityConfig[triageTicket.priority].color} bg-background font-medium shadow-sm`}>
                    {priorityConfig[triageTicket.priority].label}
                  </Badge>
                </div>
                <h3 className="font-semibold text-foreground leading-snug">{triageTicket.title}</h3>
              </div>

              {/* Selección de Agente */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-semibold">1. Seleccionar Agente</Label>
                </div>
                <Popover open={agentComboboxOpen} onOpenChange={setAgentComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={agentComboboxOpen}
                      className="w-full justify-between h-auto py-3 px-4 rounded-xl border-border/60 hover:bg-secondary/30 transition-all font-normal"
                    >
                      {triageAgentId ? (
                        (() => {
                          const agentData = agentLoads.find(a => a.agent.id === triageAgentId);
                          if (!agentData) return "Selecciona un agente...";
                          return (
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs bg-primary text-primary-foreground shadow-md">
                                {agentData.agent.firstName[0]}{agentData.agent.lastName[0]}
                              </div>
                              <span className="font-medium text-foreground">
                                {agentData.agent.firstName} {agentData.agent.lastName}
                              </span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">Buscar y seleccionar agente...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="p-0" 
                    align="start"
                    style={{ width: "var(--radix-popover-trigger-width)" }}
                  >
                    <Command>
                      <CommandInput placeholder="Buscar por nombre..." />
                      <CommandList>
                        <CommandEmpty>No se encontró ningún agente.</CommandEmpty>
                        <CommandGroup>
                          {agentLoads.map((agentData) => {
                            const isSelected = triageAgentId === agentData.agent.id;
                            return (
                              <CommandItem
                                key={agentData.agent.id}
                                value={`${agentData.agent.firstName} ${agentData.agent.lastName}`}
                                onSelect={() => {
                                  setTriageAgentId(agentData.agent.id)
                                  setAgentComboboxOpen(false)
                                }}
                                className={`flex items-center justify-between py-2.5 px-3 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                                    {agentData.agent.firstName[0]}{agentData.agent.lastName[0]}
                                  </div>
                                  <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                                    {agentData.agent.firstName} {agentData.agent.lastName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge variant="secondary" className={`${agentData.count > 5 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary/50 text-muted-foreground'} shadow-none text-[10px] px-1.5`}>
                                    {agentData.count} tickets
                                  </Badge>
                                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                                </div>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Nota Interna */}
              <div className="space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-500" />
                    <Label className="text-sm font-semibold">2. Nota Interna (Instrucciones)</Label>
                  </div>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] uppercase font-bold tracking-wider">
                    Secreto
                  </Badge>
                </div>
                <div className="relative group">
                  <Textarea 
                    placeholder="Escribe aquí las instrucciones de resolución para el agente..."
                    className="resize-none min-h-[120px] rounded-xl border-amber-500/20 focus-visible:ring-amber-500/40 focus-visible:border-amber-500/50 bg-amber-500/5 transition-all text-sm leading-relaxed pb-8"
                    value={triageNote}
                    onChange={(e) => setTriageNote(e.target.value)}
                  />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-amber-600/80 font-medium">
                    <Shield className="h-3.5 w-3.5" />
                    Invisible para el colegio
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4 mt-auto">
                <Button 
                  size="lg"
                  className="w-full rounded-xl shadow-md transition-all font-semibold"
                  disabled={!triageAgentId || isSubmittingTriage}
                  onClick={handleTriageSubmit}
                >
                  {isSubmittingTriage ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Despachando...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      Confirmar y Asignar <Send className="h-4 w-4 ml-1" />
                    </div>
                  )}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default function TriagePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background p-12 flex justify-center"><div className="h-8 w-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" /></div>}>
      <TriageContent />
    </Suspense>
  )
}
