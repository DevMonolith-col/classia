"use client"

import { useState, useEffect } from "react"
import { useParams, usePathname } from "next/navigation"
import { Search, Clock, CheckCircle2, XCircle, AlertTriangle, User, Building2, MessageSquare, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken } from "@/lib/auth"
import { attachTokenRefresh } from "@/lib/socket"
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS } from "@/components/support/ticket-categories"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED"
type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

interface SupportTicket {
  id: string
  tenantId: string
  title: string
  status: TicketStatus
  priority: TicketPriority
  category: string
  updatedAt: string
  tenant?: { name: string; slug: string }
  assignee?: { id: string; firstName: string; lastName: string }
  _count?: { comments: number }
}

const statusConfig: Record<TicketStatus, { label: string, color: string, icon: any }> = {
  OPEN: { label: "Abierto", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200", icon: AlertTriangle },
  IN_PROGRESS: { label: "En progreso", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200", icon: Clock },
  WAITING_ON_CUSTOMER: { label: "Espera", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200", icon: User },
  RESOLVED: { label: "Resuelto", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200", icon: CheckCircle2 },
  CLOSED: { label: "Cerrado", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200", icon: XCircle },
}

export function TicketSidebar({ basePath, isTenant = false }: { basePath: string, isTenant?: boolean }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "ALL">("ALL")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [socket, setSocket] = useState<Socket | null>(null)
  
  const { id: activeTicketId } = useParams() as { id?: string }

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
        if (!cancelled) setError(err instanceof Error ? err.message : "Error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchTickets()

    const token = getAccessToken()
    if (token) {
      const newSocket = io(`${API_URL}/support`, {
        auth: { token },
        transports: ["websocket"],
      })
      attachTokenRefresh(newSocket)

      newSocket.on("connect", () => {
        newSocket.emit("dashboard:join")
      })

      newSocket.on("ticket:updated", () => {
        fetchTickets() // Refrescar la lista de tickets
      })

      newSocket.on("ticket:created", () => {
        fetchTickets() // Refrescar la lista de tickets
      })

      setSocket(newSocket)

      return () => {
        cancelled = true
        newSocket.emit("dashboard:leave")
        newSocket.disconnect()
      }
    }

    return () => { cancelled = true }
  }, [])

  const filteredTickets = tickets.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false
    if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.title.toLowerCase().includes(q) && !(t.tenant?.name || "").toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold tracking-tight">Bandeja de Soporte</h2>
          {isTenant && (
            <Button size="icon" variant="ghost" asChild className="h-8 w-8">
              <Link href={`${basePath}/nuevo`}><Plus className="h-4 w-4" /></Link>
            </Button>
          )}
        </div>
        
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9 bg-muted/50 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <Button 
            variant={statusFilter === "ALL" ? "default" : "outline"} 
            size="sm" 
            className="h-7 text-xs rounded-full px-3"
            onClick={() => setStatusFilter("ALL")}
          >
            Todos
          </Button>
          <Button 
            variant={statusFilter === "OPEN" ? "default" : "outline"} 
            size="sm" 
            className="h-7 text-xs rounded-full px-3"
            onClick={() => setStatusFilter("OPEN")}
          >
            Abiertos
          </Button>
          <Button
            variant={statusFilter === "RESOLVED" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs rounded-full px-3"
            onClick={() => setStatusFilter("RESOLVED")}
          >
            Resueltos
          </Button>
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-8 w-full text-xs">
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

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-sm text-destructive">{error}</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No hay tickets que mostrar
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredTickets.map(ticket => {
              const status = statusConfig[ticket.status]
              const StatusIcon = status.icon
              const date = new Date(ticket.updatedAt).toLocaleDateString("es-CO", { month: "short", day: "numeric" })
              const isActive = activeTicketId === ticket.id
              
              return (
                <Link 
                  key={ticket.id} 
                  href={`${basePath}/${ticket.id}`}
                  className={`block p-4 transition-colors hover:bg-muted/50 ${isActive ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="font-medium text-sm line-clamp-1 flex-1">
                      {ticket.title}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{date}</span>
                  </div>
                  
                  {!isTenant && ticket.tenant && (
                    <div className="flex items-center text-xs text-muted-foreground mb-2">
                      <Building2 className="h-3 w-3 mr-1" />
                      <span className="line-clamp-1">{ticket.tenant.name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="outline" className={`${status.color} text-[10px] h-5 px-1.5`}>
                      <StatusIcon className="h-2.5 w-2.5 mr-1" />
                      {status.label}
                    </Badge>
                    
                    {ticket.priority === 'CRITICAL' && (
                      <span className="flex h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
