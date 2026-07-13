"use client"

import Link from "next/link"
import { BookOpen, Calendar, CheckCircle2, Clock, Paperclip, Pencil, Upload, FileText as FileTextIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  HOMEWORK_TYPE_COLORS,
  HOMEWORK_TYPE_LABELS,
  type Homework,
  type HomeworkType,
} from "@/components/profesor/homework-types"

const TYPE_ICONS: Record<HomeworkType, typeof FileTextIcon> = {
  TAREA: Upload,
  EXAMEN: FileTextIcon,
  QUIZ: CheckCircle2,
  PROYECTO: BookOpen,
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  homework: Homework
  editHref?: string
  onAttachmentClick?: (key: string) => void
  showTeacher?: boolean
  showGroup?: boolean
}

export function AssignmentCard({ homework, editHref, onAttachmentClick, showTeacher, showGroup }: Props) {
  const Icon = TYPE_ICONS[homework.type]
  const totalStudents = homework.group._count?.students ?? 0
  const submitted = homework._count?.submissions ?? 0
  const graded = homework._count?.marks ?? 0
  const submittedPct = totalStudents > 0 ? Math.round((submitted / totalStudents) * 100) : 0
  const gradedPct = totalStudents > 0 ? Math.round((graded / totalStudents) * 100) : 0
  const isOverdue = homework.status === "ACTIVE" && new Date(homework.dueDate) < new Date()

  const subtitleParts = [
    showGroup ? homework.group.name : null,
    homework.subject.name,
    showTeacher && homework.teacher ? `Prof. ${homework.teacher.user.firstName} ${homework.teacher.user.lastName}` : null,
  ].filter(Boolean)

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <Icon className="h-6 w-6 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{homework.title}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HOMEWORK_TYPE_COLORS[homework.type]}`}>
                    {HOMEWORK_TYPE_LABELS[homework.type]}
                  </span>
                  <Badge variant="outline">{homework.weight}%</Badge>
                  {homework.status !== "ACTIVE" && <Badge variant="secondary">{homework.status}</Badge>}
                </div>
                {subtitleParts.length > 0 && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitleParts.join(" · ")}</p>
                )}
                {homework.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{homework.description}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Creada: {new Date(homework.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span className={isOverdue ? "font-medium text-red-600" : ""}>
                  Entrega: {formatDueDate(homework.dueDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-secondary/30 p-4 sm:p-6 lg:w-72 lg:border-l lg:border-t-0">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Entregas</span>
                  <span className="font-medium text-foreground">{submitted}/{totalStudents}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-blue-500 transition-all" style={{ width: `${submittedPct}%` }} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Calificadas</span>
                  <span className="font-medium text-foreground">{graded}/{totalStudents}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${gradedPct}%` }} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {homework.attachmentKey && onAttachmentClick && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => onAttachmentClick(homework.attachmentKey!)}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Ver archivo
                  </Button>
                )}
                {editHref && (
                  <Button size="sm" className="flex-1 gap-1.5" asChild>
                    <Link href={editHref}>
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
