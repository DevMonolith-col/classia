"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Save } from "lucide-react"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type DocType = "STUDY_CERTIFICATE" | "REPORT_CARD"

const VARS_BY_TYPE: Record<DocType, string[]> = {
  STUDY_CERTIFICATE: ["studentName", "studentDocument", "tenantName", "groupName", "issuedDate", "verificationCode", "verifyUrl", "qrDataUrl"],
  REPORT_CARD: ["studentName", "studentDocument", "tenantName", "groupName", "overallAverage", "scaleName", "issuedDate", "verificationCode", "verifyUrl", "qrDataUrl"],
}

export default function PlantillasCertificadosPage() {
  const [type, setType] = useState<DocType>("STUDY_CERTIFICATE")
  const [name, setName] = useState("")
  const [contentHtml, setContentHtml] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (docType: DocType) => {
    setLoading(true)
    const res = await apiFetch(`/documents/templates/${docType}`, { silent: true })
    if (res.ok) {
      const data = await res.json()
      setName(data.name)
      setContentHtml(data.contentHtml)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load(type)
  }, [type, load])

  const save = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/documents/templates/${type}`, {
        method: "PUT",
        body: JSON.stringify({ name, contentHtml }),
      })
      if (!res.ok) throw new Error("No se pudo guardar la plantilla")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/certificados"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Plantillas de certificados</h1>
          <p className="text-sm text-muted-foreground">HTML con variables entre llaves dobles, ej. <code>{"{{studentName}}"}</code>.</p>
        </div>
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as DocType)}>
        <TabsList>
          <TabsTrigger value="STUDY_CERTIFICATE">Constancia de estudio</TabsTrigger>
          <TabsTrigger value="REPORT_CARD">Certificación de boletín</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Variables disponibles</CardTitle>
              <CardDescription>Se reemplazan automáticamente al generar el PDF.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {VARS_BY_TYPE[type].map((v) => (
                <code key={v} className="rounded bg-secondary px-2 py-1 text-xs">{`{{${v}}}`}</code>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="space-y-1.5">
                <Label>Nombre de la plantilla</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>HTML</Label>
                <Textarea
                  value={contentHtml}
                  onChange={(e) => setContentHtml(e.target.value)}
                  rows={20}
                  className="font-mono text-xs"
                />
              </div>
              <Button onClick={save} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" /> {saving ? "Guardando..." : "Guardar plantilla"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
