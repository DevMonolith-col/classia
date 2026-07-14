"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const PdfViewer = dynamic(() => import("./pdf-viewer").then((mod) => mod.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  ),
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileKey: string | null
  fileName?: string | null
}

export function AttachmentPreviewDialog({ open, onOpenChange, fileKey, fileName }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isPdf = (fileName ?? "").toLowerCase().endsWith(".pdf")

  useEffect(() => {
    if (!open || !fileKey) {
      setUrl(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setUrl(null)

    apiFetch(`/files/url?key=${encodeURIComponent(fileKey)}`, { silent: true })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = (await res.json()) as { url: string }
        if (!cancelled) setUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("No se pudo abrir el archivo.")
          onOpenChange(false)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileKey])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{fileName ?? "Archivo"}</DialogTitle>
        </DialogHeader>

        {loading || !url ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : isPdf ? (
          <PdfViewer url={url} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              La vista previa dentro de la plataforma solo está disponible para PDF.
            </p>
            <Button asChild size="sm" className="gap-1.5">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir archivo
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
