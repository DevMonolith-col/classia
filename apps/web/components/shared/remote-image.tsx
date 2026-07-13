"use client"

import { useEffect, useState } from "react"
import { ImageOff } from "lucide-react"
import { apiFetch } from "@/lib/api-client"

interface Props {
  fileKey: string
  alt: string
  className?: string
}

export function RemoteImage({ fileKey, alt, className }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setFailed(false)
    apiFetch(`/files/url?key=${encodeURIComponent(fileKey)}`, { silent: true })
      .then(async (res) => {
        if (!res.ok) throw new Error()
        const data = (await res.json()) as { url: string }
        if (!cancelled) setUrl(data.url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [fileKey])

  if (failed) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-lg bg-secondary p-6 text-sm text-muted-foreground ${className ?? ""}`}>
        <ImageOff className="h-4 w-4" />
        No se pudo cargar la imagen.
      </div>
    )
  }

  if (!url) {
    return <div className={`animate-pulse rounded-lg bg-secondary ${className ?? "h-40"}`} />
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className ?? "max-h-80 rounded-lg border border-border object-contain"} />
}
