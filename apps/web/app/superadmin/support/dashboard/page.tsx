"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  LifeBuoy,
  Clock,
  ArrowRight,
  User,
  Building2,
  AlertTriangle,
  User as UserIcon,
  Activity,
  TimerReset,
  BarChart2,
  PieChart as PieChartIcon
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api-client"
import Link from "next/link"
import { io, Socket } from "socket.io-client"
import { API_URL } from "@/lib/env"
import { getAccessToken } from "@/lib/auth"
import { attachTokenRefresh } from "@/lib/socket"
import { TICKET_CATEGORY_LABELS } from "@/components/support/ticket-categories"
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Bar 
} from 'recharts'

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
}

interface SupportAgent {
  id: string
  firstName: string
  lastName: string
  role: string
}

const CATEGORY_COLORS = [
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#ec4899', // pink-500
]

export default function SuperAdminSupportDashboard() {
  const router = useRouter()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [agents, setAgents] = useState<SupportAgent[]>([])
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    let cancelled = false
    async function fetchTickets() {
      try {
        const [ticketsRes, agentsRes] = await Promise.all([
          apiFetch("/support/tickets", { silent: true }),
          apiFetch("/support/agents", { silent: true }),
        ])
        if (!ticketsRes.ok) throw new Error("Error al cargar los tickets")
        const data = await ticketsRes.json()
        if (!cancelled) setTickets(data)
        if (!cancelled && agentsRes.ok) setAgents(await agentsRes.json())
      } catch (err) {
        // Silently fail for now
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

  // 1. Core KPIs
  const activeTickets = tickets.filter(t => t.status !== "RESOLVED" && t.status !== "CLOSED")
  const criticalTickets = activeTickets.filter(t => t.priority === "CRITICAL")
  const unassignedTickets = activeTickets.filter(t => !t.assignee)
  
  // SLA Risks (> 24h old and still active)
  const SLA_LIMIT_MS = 24 * 60 * 60 * 1000
  const now = Date.now()
  const slaRisks = activeTickets.filter(t => (now - new Date(t.createdAt).getTime()) > SLA_LIMIT_MS)
  
  // Max Backlog Age
  let oldestTicketAge = "0h"
  if (activeTickets.length > 0) {
    const oldest = activeTickets.reduce((prev, current) => (new Date(prev.createdAt) < new Date(current.createdAt)) ? prev : current)
    const diffHours = Math.floor((now - new Date(oldest.createdAt).getTime()) / (1000 * 60 * 60))
    if (diffHours > 24) oldestTicketAge = `${Math.floor(diffHours/24)}d ${diffHours%24}h`
    else oldestTicketAge = `${diffHours}h`
  }

  // 2. Chart Data Aggregations
  const categoryCount = new Map<string, number>()
  activeTickets.forEach(t => {
    categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1)
  })
  const categoryData = Array.from(categoryCount.entries()).map(([cat, count]) => ({
    name: TICKET_CATEGORY_LABELS[cat as keyof typeof TICKET_CATEGORY_LABELS] || cat,
    value: count,
    originalCategory: cat
  })).sort((a,b) => b.value - a.value)

  const statusCount = new Map<string, number>()
  activeTickets.forEach(t => {
    statusCount.set(t.status, (statusCount.get(t.status) || 0) + 1)
  })
  const statusData = [
    { name: "Abiertos", count: statusCount.get("OPEN") || 0, fill: "#3b82f6", originalStatus: "OPEN" },
    { name: "En Progreso", count: statusCount.get("IN_PROGRESS") || 0, fill: "#8b5cf6", originalStatus: "IN_PROGRESS" },
    { name: "Esperando Cliente", count: statusCount.get("WAITING_ON_CUSTOMER") || 0, fill: "#f59e0b", originalStatus: "WAITING_ON_CUSTOMER" },
  ]

  // 3. Operational Lists (Tenants & Agents)
  const tenantMap = new Map<string, { id: string, name: string, count: number, critical: number }>()
  activeTickets.forEach(t => {
    if (t.tenant) {
      const existing = tenantMap.get(t.tenantId)
      if (existing) {
        existing.count++
        if (t.priority === "CRITICAL") existing.critical++
      } else {
        tenantMap.set(t.tenantId, { 
          id: t.tenantId, 
          name: t.tenant.name, 
          count: 1,
          critical: t.priority === "CRITICAL" ? 1 : 0
        })
      }
    }
  })
  const tenantsWithTickets = Array.from(tenantMap.values()).sort((a, b) => b.count - a.count)

  const agentMap = new Map<string, { agent: SupportAgent, count: number }>()
  agents.forEach(a => agentMap.set(a.id, { agent: a, count: 0 }))
  activeTickets.forEach(t => {
    if (t.assignee) {
      const existing = agentMap.get(t.assignee.id)
      if (existing) existing.count++
    }
  })
  const agentLoads = Array.from(agentMap.values()).sort((a, b) => b.count - a.count)
  const maxAgentLoad = Math.max(1, ...agentLoads.map(a => a.count))

  // Navigation Helpers
  const goTriage = (query: string) => router.push(`/superadmin/support/triage?${query}`)

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-muted/30 pb-12">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              Soporte B2B - Centro de Mando
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Supervisa KPIs, SLA y distribución operativa en tiempo real.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="default" asChild>
              <Link href="/superadmin/support/triage">
                Ir a Cola de Triage
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/superadmin/support/inbox">
                Inbox de Agente
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        
        {/* ROW 1: CORE KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="shadow-sm cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => goTriage('assigneeId=UNASSIGNED')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">Sin Asignar</CardTitle>
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{unassignedTickets.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Tickets esperando agente</p>
            </CardContent>
          </Card>

          <Card 
            className="shadow-sm cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => goTriage('priority=CRITICAL')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-destructive">Fuegos Críticos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-destructive">{criticalTickets.length}</div>
              <p className="text-xs text-destructive/80 mt-1">Incidentes de máxima prioridad</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-foreground">
                Riesgo de SLA (&gt;24h)
              </CardTitle>
              <TimerReset className={`h-4 w-4 ${slaRisks.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${slaRisks.length > 0 ? 'text-destructive' : ''}`}>{slaRisks.length}</div>
              <p className="text-xs mt-1 text-muted-foreground">
                Tickets envejecidos sin cerrar
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Edad Máx. Backlog</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{oldestTicketAge}</div>
              <p className="text-xs text-muted-foreground mt-1">Tiempo del ticket más antiguo</p>
            </CardContent>
          </Card>
        </div>

        {/* ROW 2: CHARTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Categorías (PieChart) */}
          <Card className="shadow-sm flex flex-col">
            <CardHeader className="border-b border-border py-4 bg-card/50">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-muted-foreground" />
                Tendencias por Categoría
              </CardTitle>
              <CardDescription>Volumen de quejas/consultas activas.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center gap-4">
              {categoryData.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm">No hay datos suficientes.</div>
              ) : (
                <>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={90}
                          paddingAngle={0}
                          stroke="var(--background)"
                          strokeWidth={2}
                          dataKey="value"
                          onClick={(data) => goTriage(`category=${data.originalCategory}`)}
                          className="cursor-pointer outline-none"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} className="hover:opacity-80 transition-opacity outline-none" />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => [`${value} tickets`, 'Cantidad']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          itemStyle={{ color: 'var(--foreground)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Custom Tailwind Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 mt-4 mb-2 px-2">
                    {categoryData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div 
                          className="h-2.5 w-2.5 rounded-full shadow-sm" 
                          style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} 
                        />
                        <span className="truncate max-w-[140px]" title={entry.name}>{entry.name}</span>
                        <span className="font-semibold text-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Estado del Embudo (BarChart) */}
          <Card className="shadow-sm flex flex-col">
            <CardHeader className="border-b border-border py-4 bg-card/50">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-muted-foreground" />
                Embudo Operativo
              </CardTitle>
              <CardDescription>Estado de los tickets que están siendo trabajados.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-center gap-4">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" vertical={true} opacity={0.5} />
                    <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={110} stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      cursor={{ fill: 'var(--secondary)', opacity: 0.4 }}
                      formatter={(value: number) => [`${value} tickets`, 'Volumen']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: 'var(--foreground)' }}
                    />
                    <Bar 
                      dataKey="count" 
                      radius={[4, 4, 4, 4]}
                      barSize={24}
                      onClick={(data) => goTriage(`status=${data.originalStatus}`)}
                      className="cursor-pointer"
                    >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                    ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ROW 3: LISTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Colegios con atención requerida */}
          <Card className="shadow-sm flex flex-col h-[500px]">
            <CardHeader className="border-b border-border py-4 bg-card/50">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                Colegios Afectados
              </CardTitle>
              <CardDescription>Colegios con tickets activos. Clic para ver detalle.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {tenantsWithTickets.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Ningún colegio requiere atención.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {tenantsWithTickets.map(tenant => (
                    <button 
                      key={tenant.id} 
                      onClick={() => goTriage(`tenantId=${tenant.id}`)}
                      className="w-full text-left p-4 flex items-center justify-between transition-colors hover:bg-secondary/50 group"
                    >
                      <div className="min-w-0 flex-1 pr-4">
                        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{tenant.name}</p>
                        {tenant.critical > 0 && (
                          <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            {tenant.critical} crítico(s)
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                        {tenant.count} tickets
                        <ArrowRight className="h-3 w-3 ml-1.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Carga de Agentes */}
          <Card className="shadow-sm flex flex-col h-[500px]">
            <CardHeader className="border-b border-border py-4 bg-card/50">
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-muted-foreground" />
                Carga Operativa de Agentes
              </CardTitle>
              <CardDescription>Distribución de tickets. Clic para despachar.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-y-auto flex-1">
              {agentLoads.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No hay agentes disponibles.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {agentLoads.map(agentData => {
                    const progress = maxAgentLoad > 0 ? (agentData.count / maxAgentLoad) * 100 : 0
                    return (
                      <button 
                        key={agentData.agent.id}
                        onClick={() => goTriage(`assigneeId=${agentData.agent.id}`)}
                        className="w-full text-left p-5 flex flex-col gap-2.5 transition-colors hover:bg-secondary/50 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                              {agentData.agent.firstName[0]}{agentData.agent.lastName[0]}
                            </div>
                            <p className="font-medium text-sm group-hover:text-primary transition-colors">
                              {agentData.agent.firstName} {agentData.agent.lastName}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs group-hover:border-primary/50 transition-colors">
                            {agentData.count} <span className="text-muted-foreground ml-1">asignados</span>
                          </Badge>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full transition-all duration-500 ease-out ${agentData.count > 0 ? (progress > 80 ? 'bg-amber-500' : 'bg-primary') : 'bg-transparent'}`} 
                            style={{ width: `${progress}%` }} 
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
