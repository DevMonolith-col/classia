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

export type GroupOption = {
  id: string
  name: string
  grade: string
  section: string
}

interface Props {
  groups: GroupOption[]
  value: string | null
  onChange: (groupId: string | null) => void
  allowAll?: boolean
  allowAllLabel?: string
  placeholder?: string
}

export function GroupCombobox({
  groups,
  value,
  onChange,
  allowAll = true,
  allowAllLabel = "Todos los cursos",
  placeholder = "Buscar curso...",
}: Props) {
  const [open, setOpen] = useState(false)
  const selected = groups.find((group) => group.id === value)

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
              {selected ? `${selected.grade}${selected.section} · ${selected.name}` : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Curso o grado..." />
          <CommandList>
            <CommandEmpty>No se encontraron cursos.</CommandEmpty>
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
                  {allowAllLabel}
                </CommandItem>
              )}
              {groups.map((group) => (
                <CommandItem
                  key={group.id}
                  value={`${group.grade}${group.section} ${group.name}`}
                  onSelect={() => {
                    onChange(group.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === group.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {group.grade}
                    {group.section} · {group.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
