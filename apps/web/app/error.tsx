"use client"

// Error boundary de segmento. Hasta el 2026-07-27 la app no tenía ninguno: cualquier fallo
// de render caía en la pantalla nativa de Next ("This page couldn't load"), sin mensaje, sin
// `digest` y sin nada que pegar en un ticket. Diagnosticar /admin/actividad fue imposible
// justamente por eso.
//
// El `digest` es la única forma de cruzar lo que ve el usuario con la línea del log del
// servidor, así que se muestra siempre que exista y se puede seleccionar con el cursor.

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sin esto el error solo existe dentro del boundary y nunca llega a la consola del
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
                Esta pantalla no se pudo cargar
              </CardTitle>
              {/* Este boundary vive en la raíz, por encima de los layouts de portal, así que
                  cuando se monta el sidebar ya no está en pantalla: el texto no promete que
                  el resto del panel siga a la vista. */}
              <p className="mt-1 text-muted-foreground">
                Ocurrió un error al mostrar esta sección. Puedes reintentar sin recargar la
                página.
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
