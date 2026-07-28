"use client"

// Boundary de segmento del panel del colegio.
//
// Existe por una diferencia concreta con `app/error.tsx`: aquel vive por encima de
// `app/admin/layout.tsx`, así que cuando se monta desmonta el sidebar entero y el usuario
// queda en una pantalla suelta, sin forma de navegar a otra sección. Este, al colgar del
// segmento `/admin`, se renderiza *dentro* del layout: la barra lateral sigue ahí y el
// fallo queda contenido en el área de contenido.
//
// El `digest` se muestra siempre que exista porque es lo único que cruza lo que ve el
// usuario con la línea correspondiente del log del servidor.

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AdminSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sin esto el error solo vive dentro del boundary y nunca aparece en la consola del
    // navegador, que es donde se lo busca primero.
    console.error(error)
  }, [error])

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-2xl font-bold sm:text-3xl">
                Esta sección no se pudo cargar
              </CardTitle>
              <p className="mt-1 text-muted-foreground">
                El resto del panel sigue disponible en el menú lateral. Puedes reintentar sin
                recargar la página.
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
              <p className="mt-1 break-words font-mono text-sm text-foreground">{error.message}</p>
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
              <p className="mt-1 text-xs text-muted-foreground">
                Compártelo con soporte: identifica este error exacto en los registros.
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
  )
}
