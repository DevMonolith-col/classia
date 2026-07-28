"use client"

// Último recurso: se usa solo cuando el fallo ocurre en el layout raíz, donde `app/error.tsx`
// ya no puede montarse. Reemplaza al layout raíz por completo, así que tiene que traer su
// propio <html>, su propio <body> y su propia hoja de estilos — sin el import de abajo, esta
// pantalla saldría sin una sola clase aplicada.

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import "./globals.css"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es" className="bg-background">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-2xl font-bold sm:text-3xl">
                    Classia no pudo iniciar
                  </CardTitle>
                  <p className="mt-1 text-muted-foreground">
                    El fallo ocurrió antes de que cargara el panel. Reintenta; si persiste,
                    comparte el código de referencia con soporte.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {error.message && (
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Detalle
                  </p>
                  <p className="mt-1 break-words font-mono text-sm text-foreground">
                    {error.message}
                  </p>
                </div>
              )}

              {error.digest && (
                <div className="rounded-lg border border-border bg-muted p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Código de referencia
                  </p>
                  <p className="mt-1 select-all break-all font-mono text-sm text-foreground">
                    {error.digest}
                  </p>
                </div>
              )}

              <Button onClick={reset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </body>
    </html>
  )
}
