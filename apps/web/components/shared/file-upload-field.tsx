"use client"

import { useRef, useState } from "react"
import { FileText, Loader2, Paperclip, X } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"

export type UploadedFileValue = {
  key: string
  name: string
} | null

interface Props {
  value: UploadedFileValue
  onChange: (value: UploadedFileValue) => void
  accept?: string
  disabled?: boolean
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploadField({ value, onChange, accept, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [sizeLabel, setSizeLabel] = useState<string | null>(null)

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await apiFetch("/files", {
        method: "POST",
        body: formData,
        silent: true,
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string | string[] }
        const message = Array.isArray(body.message) ? body.message.join(" ") : body.message
        throw new Error(message || "No se pudo subir el archivo.")
      }

      const data = (await res.json()) as { key: string; name: string; size: number }
      setSizeLabel(formatSize(data.size))
      onChange({ key: data.key, name: data.name })
      toast.success("Archivo subido", { description: data.name })
    } catch (err) {
      toast.error("No se pudo subir el archivo", {
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
      })
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{value.name}</p>
            {sizeLabel && <p className="text-xs text-muted-foreground">{sizeLabel}</p>}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setSizeLabel(null)
            onChange(null)
          }}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileSelected} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        {uploading ? "Subiendo..." : "Adjuntar archivo"}
      </Button>
    </div>
  )
}
