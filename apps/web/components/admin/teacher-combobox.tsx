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
import type { Teacher } from "./academic-types"

interface Props {
  teachers: Teacher[]
  value: string | null
  onChange: (teacherId: string | null) => void
  allowAll?: boolean
  placeholder?: string
}

export function TeacherCombobox({ teachers, value, onChange, allowAll = false, placeholder = "Buscar profesor..." }: Props) {
  const [open, setOpen] = useState(false)
  const selected = teachers.find((teacher) => teacher.id === value)

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
            <span className="truncate">
              {selected
                ? `${selected.user.firstName} ${selected.user.lastName}`
                : allowAll
                  ? "Todos los profesores"
                  : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Escribe un nombre o correo..." />
          <CommandList>
            <CommandEmpty>No se encontraron profesores.</CommandEmpty>
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
                  Todos los profesores
                </CommandItem>
              )}
              {teachers.map((teacher) => (
                <CommandItem
                  key={teacher.id}
                  value={`${teacher.user.firstName} ${teacher.user.lastName} ${teacher.user.email}`}
                  onSelect={() => {
                    onChange(teacher.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === teacher.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate">
                      {teacher.user.firstName} {teacher.user.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{teacher.user.email}</p>
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
