"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Loader2, Megaphone, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type TargetGroup = { id: string; name: string; grade: string; section: string }

type Announcement = {
  id: string
  title: string
  body: string
  targetRole: string | null
  createdAt: string
  isRead: boolean
  author: { id: string; firstName: string; lastName: string }
  group: { id: string; name: string } | null
}

const ROLE_LABELS: Record<string, string> = {
  GUARDIAN: "Acudientes",
  STUDENT: "Estudiantes",
  TEACHER: "Profesores",
  TENANT_ADMIN: "Administración",
  PRINCIPAL: "Administración",
  COORDINATOR: "Administración",
  SECRETARY: "Administración",
}

const SCHOOL_WIDE = "__all__"
const ALL_ROLES = "__all__"

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

interface Props {
  userRole: "admin" | "profesor" | "familia"
}

export function AnnouncementsBoard({ userRole }: Props) {
  const canPublish = userRole === "admin" || userRole === "profesor"
  const currentUserId = getCurrentUser()?.sub ?? ""

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [groups, setGroups] = useState<TargetGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [groupId, setGroupId] = useState(SCHOOL_WIDE)
  const [targetRole, setTargetRole] = useState(ALL_ROLES)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [annRes, groupsRes] = await Promise.all([
        apiFetch("/announcements"),
        canPublish ? apiFetch("/announcements/groups", { silent: true }) : Promise.resolve(null),
      ])
      if (!annRes.ok) {
        setError(true)
        return
      }
      setAnnouncements((await annRes.json()) as Announcement[])
      if (groupsRes && groupsRes.ok) {
        setGroups((await groupsRes.json()) as TargetGroup[])
      }
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [canPublish])

  useEffect(() => {
    void load()
  }, [load])

  const markRead = async (id: string) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)))
    await apiFetch(`/announcements/${id}/read`, { method: "POST", silent: true })
  }

  const handleDelete = async (id: string) => {
    const res = await apiFetch(`/announcements/${id}`, { method: "DELETE" })
    if (res.ok) {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      toast.success("Comunicado eliminado")
    }
  }

  const openDialog = () => {
    setTitle("")
    setBody("")
    setTargetRole(ALL_ROLES)
    setGroupId(userRole === "profesor" && groups.length > 0 ? groups[0].id : SCHOOL_WIDE)
    setDialogOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim() || submitting) return
    if (userRole === "profesor" && groupId === SCHOOL_WIDE) {
      toast.error("Selecciona un grupo para publicar.")
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { title: title.trim(), body: body.trim() }
      if (groupId !== SCHOOL_WIDE) payload.groupId = groupId
      if (targetRole !== ALL_ROLES) payload.targetRole = targetRole
      const res = await apiFetch("/announcements", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      if (!res.ok) return
      await load()
      toast.success("Comunicado publicado")
      setDialogOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="lg:pl-64">
        <div className="mx-auto max-w-3xl p-4 lg:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-semibold text-foreground">Comunicados</h1>
            </div>
            {canPublish && (
              <Button onClick={openDialog} className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo comunicado
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16 text-sm text-muted-foreground">
              Cargando comunicados…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-16">
              <p className="text-sm text-muted-foreground">No se pudieron cargar los comunicados.</p>
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
          ) : announcements.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <Megaphone className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No hay comunicados por ahora.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => {
                const canDelete =
                  userRole === "admin" || announcement.author.id === currentUserId
                return (
                  <article
                    key={announcement.id}
                    onClick={() => !announcement.isRead && markRead(announcement.id)}
                    className={[
                      "rounded-xl border bg-card p-4 shadow-sm transition-colors",
                      announcement.isRead
                        ? "border-border"
                        : "cursor-pointer border-primary/40 bg-primary/[0.03] hover:bg-primary/[0.06]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {!announcement.isRead && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                        <h2 className="font-semibold text-foreground">{announcement.title}</h2>
                      </div>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDelete(announcement.id)
                          }}
                          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Eliminar comunicado"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
                      {announcement.body}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {announcement.author.firstName} {announcement.author.lastName}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(announcement.createdAt)}</span>
                      {announcement.group && (
                        <Badge variant="secondary" className="font-normal">
                          {announcement.group.name}
                        </Badge>
                      )}
                      {announcement.targetRole && (
                        <Badge variant="outline" className="font-normal">
                          {ROLE_LABELS[announcement.targetRole] ?? announcement.targetRole}
                        </Badge>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {canPublish && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Nuevo comunicado</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ann-title">Título</Label>
                  <Input
                    id="ann-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Reunión de apoderados"
                    maxLength={150}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ann-body">Mensaje</Label>
                  <Textarea
                    id="ann-body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Escribe el comunicado…"
                    className="min-h-[120px]"
                    maxLength={5000}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Curso</Label>
                    <Select value={groupId} onValueChange={setGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {userRole === "admin" && (
                          <SelectItem value={SCHOOL_WIDE}>Todo el colegio</SelectItem>
                        )}
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Dirigido a</Label>
                    <Select value={targetRole} onValueChange={setTargetRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_ROLES}>Todos</SelectItem>
                        <SelectItem value="GUARDIAN">Acudientes</SelectItem>
                        <SelectItem value="STUDENT">Estudiantes</SelectItem>
                        {userRole === "admin" && (
                          <SelectItem value="TEACHER">Profesores</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting || !title.trim() || !body.trim()}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Publicar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
