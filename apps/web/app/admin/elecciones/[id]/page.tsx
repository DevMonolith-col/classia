"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Vote, Plus, Users, Lock, Megaphone, Trophy } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { getCurrentUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { StudentCombobox, type StudentOption } from "@/components/admin/student-combobox"

type Candidate = {
  id: string
  studentId: string | null
  candidateNumber: number
  slogan: string | null
  photoUrl: string | null
  student?: { firstName: string; lastName: string } | null
}

type ElectionDetail = {
  id: string
  title: string
  description: string | null
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "PUBLISHED"
  startDate: string
  endDate: string
  allowBlank: boolean
  candidates: Candidate[]
}

type Participation = { votedCount: number; eligibleTotal: number; byGroup: { groupName: string; count: number }[] }
type Results = { status: string; totalVotes: number; results: { candidateId: string; candidateNumber: number; isBlank: boolean; name: string; slogan: string | null; voteCount: number; percentage: number }[] }

const STATUS_LABELS: Record<ElectionDetail["status"], { label: string; className: string }> = {
  DRAFT: { label: "Borrador", className: "bg-slate-100 text-slate-700 border-slate-200" },
  ACTIVE: { label: "Activa", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CLOSED: { label: "Cerrada", className: "bg-amber-100 text-amber-700 border-amber-200" },
  PUBLISHED: { label: "Resultados publicados", className: "bg-blue-100 text-blue-700 border-blue-200" },
}

const MANAGE_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN", "PRINCIPAL"])
const MONITOR_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN", "PRINCIPAL", "COORDINATOR"])

export default function EleccionDetallePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [election, setElection] = useState<ElectionDetail | null>(null)
  const [participation, setParticipation] = useState<Participation | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(true)
  const [canManage, setCanManage] = useState(false)
  const [canMonitor, setCanMonitor] = useState(false)

  const [students, setStudents] = useState<StudentOption[]>([])
  const [newCandidateStudent, setNewCandidateStudent] = useState<string | null>(null)
  const [newCandidateNumber, setNewCandidateNumber] = useState("")
  const [newCandidateSlogan, setNewCandidateSlogan] = useState("")
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch(`/elections/${id}`, { silent: true })
    if (res.ok) setElection(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => {
    const user = getCurrentUser()
    setCanManage(Boolean(user && MANAGE_ROLES.has(user.role)))
    setCanMonitor(Boolean(user && MONITOR_ROLES.has(user.role)))
    load()
    apiFetch("/students", { silent: true }).then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { id: string; firstName: string; lastName: string; documentId?: string | null }[]
      setStudents(data.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, documentId: s.documentId })))
    })
  }, [load])

  useEffect(() => {
    if (!election) return
    if (election.status !== "DRAFT") {
      apiFetch(`/elections/${id}/participation`, { silent: true }).then(async (res) => {
        if (res.ok) setParticipation(await res.json())
      })
    }
    if (election.status === "CLOSED" || election.status === "PUBLISHED") {
      apiFetch(`/elections/${id}/results`, { silent: true }).then(async (res) => {
        if (res.ok) setResults(await res.json())
      })
    }
  }, [election, id])

  const addCandidate = async () => {
    if (!newCandidateStudent || !newCandidateNumber) return
    setAddingCandidate(true)
    try {
      const res = await apiFetch(`/elections/${id}/candidates`, {
        method: "POST",
        body: JSON.stringify({ studentId: newCandidateStudent, candidateNumber: Number(newCandidateNumber), slogan: newCandidateSlogan || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo agregar el candidato")
      }
      setNewCandidateStudent(null)
      setNewCandidateNumber("")
      setNewCandidateSlogan("")
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setAddingCandidate(false)
    }
  }

  const changeStatus = async (status: string) => {
    setChangingStatus(true)
    try {
      const res = await apiFetch(`/elections/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo cambiar el estado")
      }
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setChangingStatus(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
  if (!election) return <div className="p-6 text-sm text-destructive">Elección no encontrada.</div>

  const status = STATUS_LABELS[election.status]
  const realCandidates = election.candidates.filter((c) => c.studentId !== null)

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/elecciones"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{election.title}</h1>
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
          </div>
          {election.description && <p className="text-sm text-muted-foreground">{election.description}</p>}
        </div>
      </div>

      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Control de la elección</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {election.status === "DRAFT" && (
                <Button
                  onClick={() => changeStatus("ACTIVE")}
                  disabled={changingStatus || realCandidates.length === 0}
                  className="gap-2"
                >
                  <Vote className="h-4 w-4" /> Activar votación
                </Button>
              )}
              {election.status === "ACTIVE" && (
                <Button onClick={() => changeStatus("CLOSED")} disabled={changingStatus} variant="secondary" className="gap-2">
                  <Lock className="h-4 w-4" /> Cerrar votación
                </Button>
              )}
              {election.status === "CLOSED" && (
                <Button onClick={() => changeStatus("PUBLISHED")} disabled={changingStatus} className="gap-2">
                  <Megaphone className="h-4 w-4" /> Publicar resultados
                </Button>
              )}
            </div>

            {election.status === "DRAFT" && (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Agregar candidato</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <StudentCombobox students={students} value={newCandidateStudent} onChange={setNewCandidateStudent} placeholder="Buscar estudiante..." />
                  <Input
                    type="number"
                    placeholder="N°"
                    className="w-24"
                    value={newCandidateNumber}
                    onChange={(e) => setNewCandidateNumber(e.target.value)}
                  />
                </div>
                <Input placeholder="Consigna / lema (opcional)" value={newCandidateSlogan} onChange={(e) => setNewCandidateSlogan(e.target.value)} />
                <Button size="sm" onClick={addCandidate} disabled={addingCandidate || !newCandidateStudent || !newCandidateNumber} className="gap-2">
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Candidatos</CardTitle>
        </CardHeader>
        <CardContent>
          {realCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay candidatos.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {realCandidates.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {c.candidateNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.student ? `${c.student.firstName} ${c.student.lastName}` : "—"}</p>
                    {c.slogan && <p className="truncate text-xs text-muted-foreground">{c.slogan}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {canMonitor && participation && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Participación</CardTitle>
            <CardDescription>Quiénes han votado, nunca por quién.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>{participation.votedCount} de {participation.eligibleTotal} estudiantes</span>
                <span className="font-medium">
                  {participation.eligibleTotal > 0 ? Math.round((participation.votedCount / participation.eligibleTotal) * 100) : 0}%
                </span>
              </div>
              <Progress value={participation.eligibleTotal > 0 ? (participation.votedCount / participation.eligibleTotal) * 100 : 0} />
            </div>
            {participation.byGroup.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {participation.byGroup.map((g) => (
                  <div key={g.groupName} className="rounded-lg border border-border p-2 text-center">
                    <p className="text-lg font-bold">{g.count}</p>
                    <p className="text-xs text-muted-foreground">{g.groupName}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {results && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4" /> Resultados</CardTitle>
            <CardDescription>{results.totalVotes} votos en total.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.results.map((r, i) => (
              <div key={r.candidateId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={i === 0 && r.voteCount > 0 ? "font-semibold" : ""}>
                    {r.candidateNumber}. {r.name} {r.slogan && !r.isBlank ? `— ${r.slogan}` : ""}
                  </span>
                  <span className="text-muted-foreground">{r.voteCount} ({r.percentage}%)</span>
                </div>
                <Progress value={r.percentage} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
