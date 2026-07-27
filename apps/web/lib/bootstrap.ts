"use client"

import { useEffect, useState } from "react"
import { apiFetch } from "./api-client"

export type BootstrapSchedule = {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  group: { id: string; name: string; grade: string; section: string }
  subject: { id: string; name: string; code: string | null }
}

export type BootstrapSummary =
  | {
      kind: "admin"
      stats: { users: number; groups: number; students: number; teachers: number; guardians: number }
    }
  | {
      kind: "teacher"
      teacher: {
        id: string
        _count: { schedules: number; homework: number; marks: number }
        schedules: BootstrapSchedule[]
      } | null
    }
  | {
      kind: "guardian"
      guardian: {
        id: string
        students: {
          relationship: string
          isPrimary: boolean
          student: {
            id: string
            firstName: string
            lastName: string
            documentId: string | null
            isActive: boolean
            group: { id: string; name: string; grade: string; section: string } | null
          }
        }[]
      } | null
    }
  | {
      kind: "student"
      student: {
        id: string
        firstName: string
        lastName: string
        documentId: string | null
        groupId: string | null
        group: { id: string; name: string; grade: string; section: string } | null
      } | null
    }
  | { kind: "basic" }

export type Bootstrap = {
  user: { id: string; email: string; firstName: string; lastName: string; status: string }
  tenant: {
    id: string
    slug: string
    name: string
    status: string
    primaryDomain: string
    logoUrl: string | null
    brandColor: string | null
    timezone: string
  }
  membership: { id: string; role: string; status: string; permissions: string[] }
  summary: BootstrapSummary
}

// Cacheado en memoria por navegación: `GET /app/bootstrap` no cambia entre componentes de la
// misma página, así que múltiples `useBootstrap()` montados a la vez comparten un solo fetch.
let cachedBootstrap: Bootstrap | null = null
let inFlight: Promise<Bootstrap> | null = null

function fetchBootstrap(): Promise<Bootstrap> {
  if (cachedBootstrap) return Promise.resolve(cachedBootstrap)
  if (!inFlight) {
    inFlight = (async () => {
      const res = await apiFetch("/app/bootstrap", { silent: true })
      if (!res.ok) throw new Error("No se pudo cargar tu perfil.")
      const data = (await res.json()) as Bootstrap
      cachedBootstrap = data
      return data
    })().finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

export function useBootstrap() {
  const [data, setData] = useState<Bootstrap | null>(cachedBootstrap)
  const [loading, setLoading] = useState(!cachedBootstrap)
  const [error, setError] = useState("")

  useEffect(() => {
    if (cachedBootstrap) {
      setData(cachedBootstrap)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchBootstrap()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "No se pudo cargar tu perfil.")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}

// Azúcar sintáctica sobre useBootstrap(): reemplaza el bloque de fetch+narrow+manejo de error
// que estaba redeclarado en cada página de profesor/*.
export function useTeacherId() {
  const { data, loading, error: bootstrapError } = useBootstrap()

  if (loading) {
    return { teacherId: null as string | null, loading: true, error: "" }
  }

  if (bootstrapError) {
    return { teacherId: null as string | null, loading: false, error: "No se pudo cargar tu perfil de profesor." }
  }

  const teacherId = data?.summary.kind === "teacher" ? (data.summary.teacher?.id ?? null) : null
  if (!teacherId) {
    return { teacherId: null as string | null, loading: false, error: "Esta cuenta no tiene un perfil de profesor asociado." }
  }

  return { teacherId, loading: false, error: "" }
}

// Check de permiso — lo que un componente compartido debería usar en vez de preguntar "¿qué rol
// tengo?". Todavía sin consumidores (Fase 0 solo sienta la base); PermissionsGuard en el backend
// sigue siendo la única fuente real de autorización.
export function usePermissions() {
  const { data } = useBootstrap()
  const granted = new Set(data?.membership.permissions ?? [])
  return { can: (permission: string) => granted.has(permission) }
}
