"use client"

import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { AuditLog } from "./audit-types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: AuditLog | null
}

const IGNORED_KEY_PATTERN = /(^|\.)(id|createdAt|updatedAt)$/

type DiffRow = {
  key: string
  oldValue: unknown
  newValue: unknown
  status: "added" | "removed" | "changed" | "unchanged"
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function flatten(value: unknown, prefix = "", out: Record<string, unknown> = {}) {
  if (isPlainObject(value)) {
    for (const [key, nested] of Object.entries(value)) {
      flatten(nested, prefix ? `${prefix}.${key}` : key, out)
    }
  } else if (prefix) {
    out[prefix] = value
  }
  return out
}

function formatValue(value: unknown) {
  if (value === undefined) return "—"
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (typeof value === "boolean" || typeof value === "number") return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function humanizeKey(key: string) {
  return key
    .split(".")
    .map((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2"))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" › ")
}

function buildDiff(oldValues: unknown, newValues: unknown): DiffRow[] {
  const oldFlat = flatten(oldValues)
  const newFlat = flatten(newValues)
  const keys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)])

  const rows: DiffRow[] = []
  for (const key of keys) {
    if (IGNORED_KEY_PATTERN.test(key)) continue

    const hasOld = key in oldFlat
    const hasNew = key in newFlat
    const oldValue = oldFlat[key]
    const newValue = newFlat[key]

    let status: DiffRow["status"] = "unchanged"
    if (!hasOld && hasNew) status = "added"
    else if (hasOld && !hasNew) status = "removed"
    else if (formatValue(oldValue) !== formatValue(newValue)) status = "changed"

    rows.push({ key, oldValue, newValue, status })
  }

  return rows.sort((a, b) => a.key.localeCompare(b.key))
}

export function AuditLogDetailDialog({ open, onOpenChange, log }: Props) {
  const diff = useMemo(() => (log ? buildDiff(log.oldValues, log.newValues) : []), [log])

  if (!log) return null

  const changedRows = diff.filter((row) => row.status !== "unchanged")
  const unchangedRows = diff.filter((row) => row.status === "unchanged")
  const oldJson = formatJson(log.oldValues)
  const newJson = formatJson(log.newValues)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{log.action}</DialogTitle>
          <DialogDescription>
            {log.entityType ?? "—"}
            {log.entityId ? ` · ${log.entityId}` : ""} ·{" "}
            {new Date(log.createdAt).toLocaleString("es-CO")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Actor</p>
            <p className="font-medium text-foreground">{log.actorRole ?? "Sistema"}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">IP</p>
            <p className="font-medium text-foreground">{log.ipAddress ?? "—"}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cambios</p>
          {changedRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
              No hay campos modificados registrados para este evento.
            </p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {changedRows.map((row) => (
                <div key={row.key} className="rounded-md px-2 py-1.5 text-sm">
                  <p className="text-xs font-medium text-muted-foreground">{humanizeKey(row.key)}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    {row.status !== "added" && (
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 line-through">
                        {formatValue(row.oldValue)}
                      </span>
                    )}
                    {row.status === "changed" && <span className="text-muted-foreground">→</span>}
                    {row.status !== "removed" && (
                      <span className="rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-700">
                        {formatValue(row.newValue)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {unchangedRows.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Campos sin cambios ({unchangedRows.length})
            </summary>
            <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-dashed border-border p-2">
              {unchangedRows.map((row) => (
                <div key={row.key} className="flex items-center justify-between gap-3 px-1 py-0.5 text-xs">
                  <span className="text-muted-foreground">{humanizeKey(row.key)}</span>
                  <span className="truncate font-mono text-muted-foreground">{formatValue(row.newValue)}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {(oldJson || newJson) && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
              JSON crudo
            </summary>
            <div className="mt-2 space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Antes</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-secondary p-3 text-xs text-foreground">
                  {oldJson ?? "—"}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Después</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-secondary p-3 text-xs text-foreground">
                  {newJson ?? "—"}
                </pre>
              </div>
            </div>
          </details>
        )}

        {log.userAgent && (
          <p className="truncate text-xs text-muted-foreground" title={log.userAgent}>
            User-Agent: {log.userAgent}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
