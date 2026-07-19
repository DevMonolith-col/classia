"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type StudentOption = {
  id: string
  firstName: string
  lastName: string
  documentId?: string | null
  groupId?: string | null
}

interface Props {
  students: StudentOption[]
  value: string | null
  onChange: (studentId: string | null) => void
  allowAll?: boolean
  placeholder?: string
}

// Búsqueda por nombre o documento — el boletín es del estudiante, así que esta
// es la puerta de entrada principal de la vista de calificaciones del admin.
export function StudentCombobox({
  students,
  value,
  onChange,
  allowAll = false,
  placeholder = "Buscar por nombre, documento o código...",
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = students.find((student) => student.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {selected ? `${selected.firstName} ${selected.lastName}` : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nombre, documento o código..." />
          <CommandList>
            <CommandEmpty>No se encontraron estudiantes.</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem
                  value="__todos__"
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === null ? "opacity-100" : "opacity-0")} />
                  Todos los estudiantes
                </CommandItem>
              )}
              {students.map((student) => (
                <CommandItem
                  key={student.id}
                  value={`${student.firstName} ${student.lastName} ${student.documentId ?? ""}`}
                  onSelect={() => {
                    onChange(student.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === student.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate">
                      {student.firstName} {student.lastName}
                    </p>
                    {student.documentId && (
                      <p className="truncate text-xs text-muted-foreground">{student.documentId}</p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
