"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bell,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Megaphone,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

type EventType =
  | "MARK_PUBLISHED"
  | "HOMEWORK_ASSIGNED"
  | "ATTENDANCE_ABSENCE_RECORDED"
  | "MESSAGE_RECEIVED"
  | "ANNOUNCEMENT_PUBLISHED"

type Notification = {
  id: string
  eventType: EventType
  title: string
  body: string
  entityType: string | null
  entityId: string | null
  isRead: boolean
  createdAt: string
}

type Preference = { eventType: EventType; channel: string; enabled: boolean }

const EVENT_META: Record<EventType, { label: string; icon: LucideIcon; tint: string }> = {
  MARK_PUBLISHED: { label: "Calificaciones", icon: ClipboardList, tint: "text-emerald-500" },
  HOMEWORK_ASSIGNED: { label: "Tareas", icon: FileText, tint: "text-blue-500" },
  ATTENDANCE_ABSENCE_RECORDED: { label: "Asistencia", icon: ClipboardCheck, tint: "text-amber-500" },
  MESSAGE_RECEIVED: { label: "Mensajes", icon: MessageSquare, tint: "text-violet-500" },
  ANNOUNCEMENT_PUBLISHED: { label: "Comunicados", icon: Megaphone, tint: "text-rose-500" },
}

const EVENT_ORDER: EventType[] = [
  "MARK_PUBLISHED",
  "HOMEWORK_ASSIGNED",
  "ATTENDANCE_ABSENCE_RECORDED",
  "MESSAGE_RECEIVED",
  "ANNOUNCEMENT_PUBLISHED",
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "ahora"
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
}

interface Props {
  userRole: "admin" | "profesor" | "familia"
}

export function NotificationsPanel({ userRole: _userRole }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [emailPrefs, setEmailPrefs] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)

  const load = useCallback(async () => {
    try {
      const [notifRes, prefRes] = await Promise.all([
        apiFetch("/notifications"),
        apiFetch("/notifications/preferences", { silent: true }),
      ])
      if (!notifRes.ok) {
        setError(true)
        return
      }
      setNotifications((await notifRes.json()) as Notification[])
      if (prefRes.ok) {
        const rows = (await prefRes.json()) as Preference[]
        const map: Record<string, boolean> = {}
        for (const row of rows) {
          if (row.channel === "EMAIL") map[row.eventType] = row.enabled
        }
        setEmailPrefs(map)
      }
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
    await apiFetch(`/notifications/${id}/read`, { method: "POST", silent: true })
  }

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    await apiFetch("/notifications/read-all", { method: "POST", silent: true })
  }

  const toggleEmail = async (eventType: EventType, enabled: boolean) => {
    setEmailPrefs((prev) => ({ ...prev, [eventType]: enabled }))
    const res = await apiFetch("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ eventType, channel: "EMAIL", enabled }),
    })
    if (res.ok) {
      toast.success(enabled ? "Recibirás este aviso por correo" : "Ya no recibirás este aviso por correo")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="mx-auto max-w-3xl p-4 lg:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">Notificaciones</h1>
              {unreadCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-medium text-primary-foreground">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead}>
                  Marcar todo como leído
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowPrefs((v) => !v)}>
                Preferencias
              </Button>
            </div>
          </div>

          {showPrefs && (
            <div className="mb-6 rounded-xl border border-border bg-card p-4">
              <h2 className="mb-1 font-semibold text-foreground">Avisos por correo</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Las notificaciones siempre aparecen aquí. Elige además cuáles quieres recibir por
                correo electrónico.
              </p>
              <div className="space-y-1">
                {EVENT_ORDER.map((eventType) => {
                  const meta = EVENT_META[eventType]
                  const Icon = meta.icon
                  const enabled = emailPrefs[eventType] ?? true
                  return (
                    <div
                      key={eventType}
                      className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-secondary/40"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${meta.tint}`} />
                        <span className="text-sm text-foreground">{meta.label}</span>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => toggleEmail(eventType, checked)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
              Cargando notificaciones…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16">
              <p className="text-sm text-muted-foreground">No se pudieron cargar las notificaciones.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setLoading(true)
                  void load()
                }}
              >
                Reintentar
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No tienes notificaciones.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const meta = EVENT_META[notification.eventType]
                const Icon = meta?.icon ?? Bell
                return (
                  <button
                    key={notification.id}
                    onClick={() => !notification.isRead && markRead(notification.id)}
                    className={[
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      notification.isRead
                        ? "border-border bg-card"
                        : "cursor-pointer border-primary/40 bg-primary/[0.03] hover:bg-primary/[0.06]",
                    ].join(" ")}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon className={`h-4 w-4 ${meta?.tint ?? "text-muted-foreground"}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!notification.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <span className="font-medium text-foreground">{notification.title}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-foreground/80">{notification.body}</p>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
