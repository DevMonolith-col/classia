"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ShieldCheck, ShieldX, ShieldAlert } from "lucide-react"
import { API_URL } from "@/lib/env"

type VerifyResult =
  | { valid: false; revoked?: undefined }
  | { valid: true; revoked: false; type: string; issuedAt: string; studentName: string; tenantName: string }
  | { valid: false; revoked: true; type: string; issuedAt: string; studentName: string; tenantName: string }

const TYPE_LABELS: Record<string, string> = {
  STUDY_CERTIFICATE: "Constancia de estudio",
  REPORT_CARD: "Certificación de boletín",
}

export default function VerifyPage() {
  const { code } = useParams() as { code: string }
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/documents/verify/${code}`)
      .then((res) => res.json())
      .then(setResult)
      .catch(() => setResult({ valid: false }))
      .finally(() => setLoading(false))
  }, [code])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">C</span>
          </div>
        </div>
        <p className="mb-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">Verificación de documento</p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Verificando...</p>
        ) : !result || !result.valid ? (
          result?.revoked ? (
            <>
              <ShieldAlert className="mx-auto mb-3 h-12 w-12 text-amber-500" />
              <h1 className="text-lg font-semibold">Documento revocado</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Este documento fue emitido por <strong>{result.tenantName}</strong> pero ya no es válido.
              </p>
            </>
          ) : (
            <>
              <ShieldX className="mx-auto mb-3 h-12 w-12 text-destructive" />
              <h1 className="text-lg font-semibold">Código no válido</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                No encontramos ningún documento con este código de verificación.
              </p>
            </>
          )
        ) : (
          <>
            <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <h1 className="text-lg font-semibold">Documento auténtico</h1>
            <div className="mt-4 space-y-1.5 rounded-lg bg-secondary/50 p-4 text-left text-sm">
              <p><span className="text-muted-foreground">Tipo:</span> {TYPE_LABELS[result.type] ?? result.type}</p>
              <p><span className="text-muted-foreground">Estudiante:</span> {result.studentName}</p>
              <p><span className="text-muted-foreground">Institución:</span> {result.tenantName}</p>
              <p><span className="text-muted-foreground">Emitido:</span> {new Date(result.issuedAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
