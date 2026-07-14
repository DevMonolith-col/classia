"use client"

import { useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
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

export function PdfViewer({ url }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState(false)

  if (error) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No se pudo mostrar el PDF en la vista previa.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="max-h-[70vh] w-full overflow-auto rounded-lg border border-border bg-secondary/30">
        <Document
          file={url}
          onLoadSuccess={({ numPages: pages }) => setNumPages(pages)}
          onLoadError={() => setError(true)}
          loading={
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <Page pageNumber={pageNumber} width={640} />
        </Document>
      </div>
      {numPages !== null && numPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pageNumber} de {numPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
