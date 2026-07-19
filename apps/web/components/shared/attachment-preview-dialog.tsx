"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { ExternalLink, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

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
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-base font-medium">
            {fileName ?? "Archivo"}
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => onOpenChange(false)}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          {loading || !url ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isPdf ? (
            <PdfViewer url={url} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
