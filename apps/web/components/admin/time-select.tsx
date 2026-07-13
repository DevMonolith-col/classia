"use client"

import { Clock } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"))
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]

interface Props {
  id?: string
  value: string
  onChange: (value: string) => void
}

export function TimeSelect({ id, value, onChange }: Props) {
  const [hour, minute] = value.split(":")
  const safeHour = HOURS.includes(hour) ? hour : "08"
  const safeMinute = MINUTES.includes(minute) ? minute : "00"

  return (
    <div id={id} className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 shadow-xs">
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={safeHour} onValueChange={(next) => onChange(`${next}:${safeMinute}`)}>
        <SelectTrigger className="h-7 w-[4.25rem] border-0 px-1.5 shadow-none focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={safeMinute} onValueChange={(next) => onChange(`${safeHour}:${next}`)}>
        <SelectTrigger className="h-7 w-[4.25rem] border-0 px-1.5 shadow-none focus-visible:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
