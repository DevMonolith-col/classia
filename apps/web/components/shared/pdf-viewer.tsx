"use client"

import { useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Loader2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.js",
    import.meta.url,
  ).toString()
}

interface Props {
  url: string
}

const MIN_SCALE = 0.5
const MAX_SCALE = 2.5
const SCALE_STEP = 0.25

export function PdfViewer({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [fitWidth, setFitWidth] = useState(700)
  const [error, setError] = useState(false)

  // Fit pages to the available width on open and on resize, like a native PDF viewer.
  useEffect(() => {
    function measure() {
      const width = containerRef.current?.clientWidth
      if (width) setFitWidth(Math.min(width - 32, 900))
    }
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [])

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No se pudo mostrar el PDF en la vista previa.
      </p>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-center gap-4 border-b border-border bg-secondary/40 px-4 py-2">
        {numPages !== null && (
          <span className="text-sm text-muted-foreground">{numPages} página{numPages === 1 ? "" : "s"}</span>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP))}
            disabled={scale <= MIN_SCALE}
            aria-label="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP))}
            disabled={scale >= MAX_SCALE}
            aria-label="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto bg-secondary/20 p-4">
        <div className="flex flex-col items-center gap-4">
          <Document
            file={url}
            onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
            onLoadError={() => setError(true)}
            loading={
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            {numPages !== null &&
              Array.from({ length: numPages }, (_, i) => (
                <Page key={i + 1} pageNumber={i + 1} width={fitWidth * scale} className="mb-4 shadow-md" />
              ))}
          </Document>
        </div>
      </div>
    </div>
  )
}
