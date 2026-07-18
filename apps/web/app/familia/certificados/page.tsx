"use client"

import { useCallback, useEffect, useState } from "react"
import { FileCheck2, Download, RefreshCw } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type Issuance = {
  id: string
  type: "STUDY_CERTIFICATE" | "REPORT_CARD"
  status: "PENDING" | "READY" | "FAILED"
  issuedAt: string
  revokedAt: string | null
  downloadUrl: string | null
  student: { firstName: string; lastName: string }
}

const TYPE_LABELS: Record<Issuance["type"], string> = {
  STUDY_CERTIFICATE: "Constancia de estudio",
  REPORT_CARD: "Certificación de boletín",
}

export default function CertificadosFamiliaPage() {
  const [issuances, setIssuances] = useState<Issuance[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await apiFetch("/documents/mine", { silent: true })
    if (res.ok) setIssuances(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!issuances.some((i) => i.status === "PENDING")) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [issuances, load])

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" /> Certificados</h1>
        <p className="text-sm text-muted-foreground">Constancias y boletines de tus hijos, emitidos por el colegio.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : issuances.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Todavía no hay certificados emitidos.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {issuances.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{TYPE_LABELS[doc.type]}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.student.firstName} {doc.student.lastName} · {new Date(doc.issuedAt).toLocaleDateString("es-CO")}
                  </p>
                  <div className="mt-1 flex gap-1.5">
                    {doc.status === "PENDING" && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Generando...
                      </Badge>
                    )}
                    {doc.revokedAt && <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">Revocado</Badge>}
                  </div>
                </div>
                {doc.status === "READY" && doc.downloadUrl && (
                  <Button size="sm" variant="outline" asChild className="gap-2 shrink-0">
                    <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /> Descargar</a>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
