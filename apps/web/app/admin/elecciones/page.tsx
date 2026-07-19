"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Vote, Plus, Users, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type Election = {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "PUBLISHED"
  startDate: string
  endDate: string
  _count: { candidates: number; voters: number }
}

const STATUS_LABELS: Record<Election["status"], { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-700 border-slate-200" },
  ACTIVE: { label: "Activa", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CLOSED: { label: "Cerrada", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PUBLISHED: { label: "Resultados publicados", className: "bg-blue-100 text-blue-700 border-blue-200" },
}

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN", "PRINCIPAL"])

export default function EleccionesPage() {
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [canManage, setCanManage] = useState(false)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "", allowBlank: true })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/elections")
      if (!res.ok) throw new Error("No se pudieron cargar las elecciones")
      setElections(await res.json())
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const user = getCurrentUser()
    setCanManage(Boolean(user && MANAGE_ROLES.has(user.role)))
    load()
  }, [load])

  const handleCreate = async () => {
    if (!form.title.trim() || !form.startDate || !form.endDate) return
    setCreating(true)
    try {
      const res = await apiFetch("/elections", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          allowBlank: form.allowBlank,
        }),
      })
      if (!res.ok) throw new Error()
      setOpen(false)
      setForm({ title: "", description: "", startDate: "", endDate: "", allowBlank: true })
      load()
    } catch {
      alert("No se pudo crear la elección")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Vote className="h-6 w-6 text-primary" /> Gobierno Escolar
          </h1>
          <p className="text-sm text-muted-foreground">Elecciones estudiantiles del colegio.</p>
        </div>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nueva elección</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva elección</DialogTitle>
                <DialogDescription>Se crea en borrador; agregá candidatos antes de activarla.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Elección Personero 2026" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descripción (opcional)</Label>
                  <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Inicio</Label>
                    <Input type="datetime-local" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cierre</Label>
                    <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>Permitir voto en blanco</Label>
                    <p className="text-xs text-muted-foreground">Se agrega como una opción más del tarjetón.</p>
                  </div>
                  <Switch checked={form.allowBlank} onCheckedChange={(v) => setForm((f) => ({ ...f, allowBlank: v }))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreate} disabled={creating}>{creating ? "Creando..." : "Crear elección"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : elections.length === 0 ? (
            <div className="p-12 text-center">
              <Vote className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Todavía no hay elecciones registradas.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {elections.map((e) => {
                const status = STATUS_LABELS[e.status]
                return (
                  <Link
                    key={e.id}
                    href={`/admin/elecciones/${e.id}`}
                    className="flex items-center justify-between gap-4 p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{e.title}</span>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {e._count.candidates} candidatos</span>
                        <span>{e._count.voters} votos registrados</span>
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
