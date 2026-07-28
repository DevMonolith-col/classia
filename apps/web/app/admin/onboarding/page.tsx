"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Download, GraduationCap, Upload, UserPlus, XCircle } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type ImportRowResult = {
  row: number
  status: "ok" | "error"
  message: string
  entityId?: string
}

type ImportResult = {
  results: ImportRowResult[]
  summary: { total: number; ok: number; failed: number }
}

function downloadCsvTemplate(filename: string, headers: string[], example: string[]) {
  const csv = [headers.join(","), example.join(",")].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface ImportCardProps {
  icon: typeof UserPlus
  title: string
  description: string
  endpoint: string
  templateFilename: string
  templateHeaders: string[]
  templateExample: string[]
}

function ImportCard({
  icon: Icon,
  title,
  description,
  endpoint,
  templateFilename,
  templateHeaders,
  templateExample,
}: ImportCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await apiFetch(endpoint, { method: "POST", body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error("No se pudo procesar el archivo", {
          description: body?.message ?? "Verifica el formato del CSV e intenta de nuevo.",
        })
        return
      }

      setResult(await res.json())
    } catch {
      toast.error("Sin conexión con el servidor")
    } finally {
      setImporting(false)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => downloadCsvTemplate(templateFilename, templateHeaders, templateExample)}
          >
            <Download className="h-4 w-4" />
            Descargar plantilla
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" size="sm" className="max-w-[220px] gap-2" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 shrink-0" />
            <span className="truncate">{file ? file.name : "Elegir archivo CSV"}</span>
          </Button>

          <Button type="button" size="sm" onClick={handleImport} disabled={!file || importing}>
            {importing ? "Importando..." : "Importar"}
          </Button>
        </div>

        {result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {result.summary.ok} correctas
              </Badge>
              {result.summary.failed > 0 && (
                <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
                  <XCircle className="h-3.5 w-3.5" />
                  {result.summary.failed} con error
                </Badge>
              )}
              <span className="text-muted-foreground">{result.summary.total} filas procesadas</span>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results.map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="font-medium">{row.row}</TableCell>
                      <TableCell>
                        {row.status === "ok" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal text-sm text-foreground">{row.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function OnboardingPage() {
  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Onboarding masivo</h1>
        <p className="text-sm text-muted-foreground">
          Carga profesores y estudiantes desde un archivo CSV en vez de crearlos uno por uno. Las cuentas
          nuevas quedan listas de inmediato con &quot;¿Olvidaste tu contraseña?&quot; en el login.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ImportCard
          icon={UserPlus}
          title="Profesores"
          description="Cada fila crea un usuario con rol de profesor. El correo debe ser único en el colegio."
          endpoint="/onboarding/teachers/import"
          templateFilename="plantilla-profesores.csv"
          templateHeaders={["email", "firstName", "lastName"]}
          templateExample={["profesor@colegio.edu.co", "Ana", "Gómez"]}
        />

        <ImportCard
          icon={GraduationCap}
          title="Estudiantes"
          description="Cada fila crea un estudiante y lo asigna al grupo por grado y sección. Las columnas de
            acudiente son opcionales: si el correo ya existe se reutiliza, si no, se crea la cuenta."
          endpoint="/onboarding/students/import"
          templateFilename="plantilla-estudiantes.csv"
          templateHeaders={[
            "firstName",
            "lastName",
            "documentId",
            "birthDate",
            "grade",
            "section",
            "guardianEmail",
            "guardianFirstName",
            "guardianLastName",
          ]}
          templateExample={["Juan", "Pérez", "1002003004", "2015-03-20", "5", "A", "acudiente@correo.com", "Marta", "Pérez"]}
        />
      </div>
    </div>
  )
}
