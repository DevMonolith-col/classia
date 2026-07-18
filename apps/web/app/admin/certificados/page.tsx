"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { FileCheck2, Ban, Download, Settings2, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StudentCombobox, type StudentOption } from "@/components/admin/student-combobox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type DocType = "STUDY_CERTIFICATE" | "REPORT_CARD"
type DocStatus = "PENDING" | "READY" | "FAILED"

type Issuance = {
  id: string
  type: DocType
  status: DocStatus
  verificationCode: string
  pdfKey: string | null
  errorMessage: string | null
  issuedAt: string
  revokedAt: string | null
  student: { firstName: string; lastName: string }
}

type ReportCardOption = { id: string; overallAverage: number; academicYear?: { name?: string } }

const TYPE_LABELS: Record<DocType, string> = {
  STUDY_CERTIFICATE: "Constancia de estudio",
  REPORT_CARD: "Certificación de boletín",
}

const STATUS_BADGE: Record<DocStatus, { label: string; className: string }> = {
  PENDING: { label: "Generando...", className: "bg-amber-100 text-amber-700 border-amber-200" },
  READY: { label: "Listo", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  FAILED: { label: "Falló", className: "bg-red-100 text-red-700 border-red-200" },
}

export default function CertificadosPage() {
  const [issuances, setIssuances] = useState<Issuance[]>([])
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<StudentOption[]>([])

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [docType, setDocType] = useState<DocType>("STUDY_CERTIFICATE")
  const [reportCards, setReportCards] = useState<ReportCardOption[]>([])
  const [selectedReportCard, setSelectedReportCard] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Issuance | null>(null)

  const load = useCallback(async () => {
    const res = await apiFetch("/documents", { silent: true })
    if (res.ok) setIssuances(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    apiFetch("/students", { silent: true }).then(async (res) => {
      if (!res.ok) return
      const data = (await res.json()) as { id: string; firstName: string; lastName: string; documentId?: string | null }[]
      setStudents(data.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, documentId: s.documentId })))
    })
  }, [load])

  // Poll mientras haya documentos PENDING (el worker corre en segundo plano).
  useEffect(() => {
    const hasPending = issuances.some((i) => i.status === "PENDING")
    if (!hasPending) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [issuances, load])

  useEffect(() => {
    if (docType !== "REPORT_CARD" || !selectedStudent) {
      setReportCards([])
      setSelectedReportCard(null)
      return
    }
    apiFetch(`/report-cards?studentId=${selectedStudent}`, { silent: true }).then(async (res) => {
      if (!res.ok) return
      setReportCards(await res.json())
    })
  }, [docType, selectedStudent])

  const issue = async () => {
    if (!selectedStudent) return
    if (docType === "REPORT_CARD" && !selectedReportCard) return
    setIssuing(true)
    try {
      const res = await apiFetch("/documents", {
        method: "POST",
        body: JSON.stringify({ studentId: selectedStudent, type: docType, reportCardId: docType === "REPORT_CARD" ? selectedReportCard : undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "No se pudo emitir el documento")
      }
      setSelectedStudent(null)
      setSelectedReportCard(null)
      load()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setIssuing(false)
    }
  }

  const confirmRevoke = async () => {
    if (!revokeTarget) return
    const res = await apiFetch(`/documents/${revokeTarget.id}/revoke`, { method: "PATCH" })
    setRevokeTarget(null)
    if (res.ok) load()
  }

  const download = async (id: string) => {
    const res = await apiFetch(`/documents/${id}/status`, { silent: true })
    if (!res.ok) return
    const body = await res.json()
    if (body.downloadUrl) window.open(body.downloadUrl, "_blank")
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-primary" /> Certificados
          </h1>
          <p className="text-sm text-muted-foreground">Constancias y boletines certificados, verificables por QR.</p>
        </div>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/admin/certificados/plantillas"><Settings2 className="h-4 w-4" /> Plantillas</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Emitir certificado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <StudentCombobox students={students} value={selectedStudent} onChange={setSelectedStudent} placeholder="Buscar estudiante..." />
            <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDY_CERTIFICATE">Constancia de estudio</SelectItem>
                <SelectItem value="REPORT_CARD">Certificación de boletín</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {docType === "REPORT_CARD" && selectedStudent && (
            <Select value={selectedReportCard ?? ""} onValueChange={setSelectedReportCard}>
              <SelectTrigger><SelectValue placeholder="Elegí el boletín a certificar..." /></SelectTrigger>
              <SelectContent>
                {reportCards.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Este estudiante no tiene boletines generados.</div>
                ) : (
                  reportCards.map((rc) => (
                    <SelectItem key={rc.id} value={rc.id}>
                      Promedio {rc.overallAverage.toFixed(1)} {rc.academicYear?.name ? `— ${rc.academicYear.name}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={issue}
            disabled={issuing || !selectedStudent || (docType === "REPORT_CARD" && !selectedReportCard)}
            className="gap-2"
          >
            <FileCheck2 className="h-4 w-4" /> {issuing ? "Emitiendo..." : "Emitir certificado"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : issuances.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Todavía no se han emitido certificados.</div>
          ) : (
            <div className="divide-y divide-border">
              {issuances.map((doc) => {
                const status = STATUS_BADGE[doc.status]
                const revoked = Boolean(doc.revokedAt)
                return (
                  <div key={doc.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{doc.student.firstName} {doc.student.lastName}</span>
                        <Badge variant="outline" className={status.className}>
                          {doc.status === "PENDING" && <RefreshCw className="mr-1 h-3 w-3 animate-spin" />}
                          {status.label}
                        </Badge>
                        {revoked && <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Revocado</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {TYPE_LABELS[doc.type]} · código {doc.verificationCode} · {new Date(doc.issuedAt).toLocaleDateString("es-CO")}
                      </p>
                      {doc.status === "FAILED" && doc.errorMessage && (
                        <p className="mt-1 text-xs text-destructive">{doc.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {doc.status === "READY" && (
                        <Button variant="ghost" size="icon" onClick={() => download(doc.id)} title="Descargar">
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {!revoked && doc.status === "READY" && (
                        <Button variant="ghost" size="icon" onClick={() => setRevokeTarget(doc)} title="Revocar">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              El código QR de {revokeTarget?.student.firstName} {revokeTarget?.student.lastName} dejará de ser válido para
              quien lo verifique. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke}>Revocar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
