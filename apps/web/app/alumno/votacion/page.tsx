"use client"

import { useCallback, useEffect, useState } from "react"
import { Vote, CheckCircle2, Circle } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type VotableElection = {
  id: string
  title: string
  description: string | null
  endDate: string
  alreadyVoted: boolean
}

type Candidate = {
  id: string
  studentId: string | null
  candidateNumber: number
  slogan: string | null
  photoUrl: string | null
  student?: { firstName: string; lastName: string } | null
}

type Ballot = {
  id: string
  title: string
  description: string | null
  allowBlank: boolean
  endDate: string
  alreadyVoted: boolean
  candidates: Candidate[]
}

export default function VotacionPage() {
  const [elections, setElections] = useState<VotableElection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ballot, setBallot] = useState<Ballot | null>(null)
  const [chosenCandidateId, setChosenCandidateId] = useState<string | null | "none">("none")
  const [submitting, setSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const loadElections = useCallback(async () => {
    setLoading(true)
    const res = await apiFetch("/elections/active", { silent: true })
    if (res.ok) setElections(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    loadElections()
  }, [loadElections])

  const openBallot = async (electionId: string) => {
    setSelectedId(electionId)
    setBallot(null)
    setConfirmed(false)
    setChosenCandidateId("none")
    const res = await apiFetch(`/elections/${electionId}/ballot`, { silent: true })
    if (res.ok) setBallot(await res.json())
  }

  const submitVote = async () => {
    if (!selectedId || chosenCandidateId === "none") return
    setSubmitting(true)
    try {
      const res = await apiFetch(`/elections/${selectedId}/vote`, {
        method: "POST",
        body: JSON.stringify({ candidateId: chosenCandidateId === "blank" ? null : chosenCandidateId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo registrar el voto")
      }
      setConfirmed(true)
      loadElections()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSubmitting(false)
    }
  }

  if (selectedId && ballot) {
    const blankCandidate = ballot.candidates.find((c) => c.studentId === null)
    const realCandidates = ballot.candidates.filter((c) => c.studentId !== null)

    if (ballot.alreadyVoted || confirmed) {
      return (
        <div className="p-4 lg:p-6 max-w-lg mx-auto">
          <Card>
            <CardContent className="p-10 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="text-lg font-semibold">Tu voto ya quedó registrado</h2>
              <p className="mt-1 text-sm text-muted-foreground">Gracias por participar en {ballot.title}.</p>
              <Button variant="outline" className="mt-6" onClick={() => { setSelectedId(null); setBallot(null) }}>
                Volver
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-4">
        <div>
          <h1 className="text-xl font-bold">{ballot.title}</h1>
          {ballot.description && <p className="text-sm text-muted-foreground">{ballot.description}</p>}
        </div>

        <div className="space-y-2">
          {realCandidates.map((c) => (
            <button
              key={c.id}
              onClick={() => setChosenCandidateId(c.id)}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                chosenCandidateId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
              }`}
            >
              {chosenCandidateId === c.id ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {c.candidateNumber}
              </div>
              <div className="min-w-0">
                <p className="font-medium">{c.student ? `${c.student.firstName} ${c.student.lastName}` : "—"}</p>
                {c.slogan && <p className="text-xs text-muted-foreground">{c.slogan}</p>}
              </div>
            </button>
          ))}

          {ballot.allowBlank && blankCandidate && (
            <button
              onClick={() => setChosenCandidateId("blank")}
              className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                chosenCandidateId === "blank" ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
              }`}
            >
              {chosenCandidateId === "blank" ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">0</div>
              <p className="font-medium">Voto en blanco</p>
            </button>
          )}
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={chosenCandidateId === "none" || submitting}
          onClick={submitVote}
        >
          {submitting ? "Enviando..." : "Confirmar voto"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => { setSelectedId(null); setBallot(null) }}>
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><Vote className="h-5 w-5 text-primary" /> Votación</h1>
        <p className="text-sm text-muted-foreground">Elecciones activas del colegio.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : elections.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No hay elecciones activas en este momento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {elections.map((e) => (
            <Card key={e.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{e.title}</CardTitle>
                  {e.alreadyVoted && <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Ya votaste</Badge>}
                </div>
                {e.description && <CardDescription>{e.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant={e.alreadyVoted ? "outline" : "default"} onClick={() => openBallot(e.id)}>
                  {e.alreadyVoted ? "Ver" : "Votar ahora"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
