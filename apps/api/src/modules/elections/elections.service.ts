import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { ElectionStatus, Prisma } from "@prisma/client"
import { Request } from "express"
import { RequestUser } from "../../common/types/request-context"
import { PERMISSIONS } from "../../common/permissions/permissions"
import { AuditService } from "../../core/audit/audit.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { AddCandidateInput, CreateElectionInput, UpdateElectionInput } from "./elections.schemas"

const ELECTION_LIST_PAGE_SIZE = 200

// Transiciones válidas: solo hacia adelante, sin saltos ni retrocesos. Una
// vez ACTIVE, la elección no puede volver a DRAFT (evita reabrir el tarjetón
// después de que alguien ya vio candidatos/votó).
const VALID_TRANSITIONS: Record<ElectionStatus, ElectionStatus[]> = {
  DRAFT: [ElectionStatus.ACTIVE],
  ACTIVE: [ElectionStatus.CLOSED],
  CLOSED: [ElectionStatus.PUBLISHED],
  PUBLISHED: [],
}

@Injectable()
export class ElectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createElection(actor: RequestUser, data: CreateElectionInput, request: Request) {
    this.assertTenant(actor)

    const election = await this.prisma.election.create({
      data: {
        tenantId: actor.tenantId,
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        allowBlank: data.allowBlank,
        createdById: actor.id,
        // El voto en blanco es un candidato más del tarjetón (studentId
        // null), creado aquí mismo para que exista desde el principio en
        // vez de improvisarlo al momento de votar.
        ...(data.allowBlank
          ? {
              candidates: {
                create: [{ tenantId: actor.tenantId, studentId: null, candidateNumber: 0, slogan: "Voto en blanco" }],
              },
            }
          : {}),
      },
    })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "election.created",
      entityType: "Election",
      entityId: election.id,
      newValues: { title: election.title },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return election
  }

  async listElections(actor: RequestUser) {
    this.assertTenant(actor)
    return this.prisma.election.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: "desc" },
      take: ELECTION_LIST_PAGE_SIZE,
      include: { _count: { select: { candidates: true, voters: true } } },
    })
  }

  // Para el estudiante: solo lo que puede votar, sin el resto del panel de
  // gestión (que exige ELECTIONS_MONITOR, permiso que un estudiante no tiene).
  async listVotableElections(actor: RequestUser) {
    const student = await this.resolveVotingStudent(actor)
    const now = new Date()

    const elections = await this.prisma.election.findMany({
      where: { tenantId: actor.tenantId, status: ElectionStatus.ACTIVE, startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { endDate: "asc" },
      select: { id: true, title: true, description: true, endDate: true },
    })
    if (elections.length === 0) return []

    const voted = await this.prisma.electionVoter.findMany({
      where: { studentId: student.id, electionId: { in: elections.map((e) => e.id) } },
      select: { electionId: true },
    })
    const votedIds = new Set(voted.map((v) => v.electionId))

    return elections.map((e) => ({ ...e, alreadyVoted: votedIds.has(e.id) }))
  }

  async getElection(electionId: string, actor: RequestUser) {
    return this.findElectionOrThrow(electionId, actor.tenantId)
  }

  async updateElection(electionId: string, actor: RequestUser, data: UpdateElectionInput, request: Request) {
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)
    if (election.status !== ElectionStatus.DRAFT) {
      throw new BadRequestException("Solo se puede editar mientras la elección está en borrador")
    }

    const updated = await this.prisma.election.update({
      where: { id: electionId },
      data: {
        title: data.title,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "election.updated",
      entityType: "Election",
      entityId: electionId,
      oldValues: { title: election.title, startDate: election.startDate, endDate: election.endDate },
      newValues: { title: updated.title, startDate: updated.startDate, endDate: updated.endDate },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  async addCandidate(electionId: string, actor: RequestUser, data: AddCandidateInput, request: Request) {
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)
    if (election.status !== ElectionStatus.DRAFT) {
      throw new BadRequestException("Solo se pueden agregar candidatos mientras la elección está en borrador")
    }

    if (data.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: data.studentId, tenantId: actor.tenantId },
        select: { id: true },
      })
      if (!student) {
        throw new BadRequestException("El estudiante candidato no pertenece a este colegio")
      }
    }

    let candidate
    try {
      candidate = await this.prisma.electionCandidate.create({
        data: {
          electionId,
          tenantId: actor.tenantId,
          studentId: data.studentId,
          candidateNumber: data.candidateNumber,
          slogan: data.slogan,
          photoUrl: data.photoUrl,
        },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new BadRequestException(`Ya existe un candidato con el número ${data.candidateNumber}`)
      }
      throw e
    }

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "election.candidate_added",
      entityType: "Election",
      entityId: electionId,
      newValues: { candidateNumber: candidate.candidateNumber, studentId: candidate.studentId },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return candidate
  }

  async deleteCandidate(electionId: string, candidateId: string, actor: RequestUser, request: Request) {
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)
    if (election.status !== ElectionStatus.DRAFT) {
      throw new BadRequestException("Solo se pueden quitar candidatos mientras la elección está en borrador")
    }

    const candidate = election.candidates.find((c) => c.id === candidateId)
    if (!candidate) {
      throw new NotFoundException("Candidato no encontrado")
    }
    if (candidate.studentId === null) {
      throw new BadRequestException("La opción de voto en blanco no se puede eliminar; desactivá el voto en blanco al crear la elección si no la querés")
    }

    await this.prisma.electionCandidate.delete({ where: { id: candidateId } })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "election.candidate_removed",
      entityType: "Election",
      entityId: electionId,
      oldValues: { candidateNumber: candidate.candidateNumber, studentId: candidate.studentId },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return { status: "ok" as const }
  }

  async updateStatus(electionId: string, actor: RequestUser, nextStatus: ElectionStatus, request: Request) {
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)

    if (!VALID_TRANSITIONS[election.status].includes(nextStatus)) {
      throw new BadRequestException(`No se puede pasar de ${election.status} a ${nextStatus}`)
    }
    if (nextStatus === ElectionStatus.ACTIVE && election.candidates.length === 0) {
      throw new BadRequestException("La elección necesita al menos un candidato antes de activarse")
    }

    const updated = await this.prisma.election.update({
      where: { id: electionId },
      data: { status: nextStatus },
    })

    await this.audit.record({
      tenantId: actor.tenantId,
      userId: actor.id,
      actorRole: actor.role,
      action: "election.status_changed",
      entityType: "Election",
      entityId: electionId,
      oldValues: { status: election.status },
      newValues: { status: nextStatus },
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })

    return updated
  }

  // ─── Votación ────────────────────────────────────────────────────────────────

  async getBallot(electionId: string, actor: RequestUser) {
    const student = await this.resolveVotingStudent(actor)
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)

    if (!this.isVotingOpen(election)) {
      throw new ForbiddenException("Esta elección no está activa en este momento")
    }

    const alreadyVoted = await this.prisma.electionVoter.findUnique({
      where: { electionId_studentId: { electionId, studentId: student.id } },
      select: { id: true },
    })

    return {
      id: election.id,
      title: election.title,
      description: election.description,
      allowBlank: election.allowBlank,
      endDate: election.endDate,
      alreadyVoted: Boolean(alreadyVoted),
      candidates: election.candidates,
    }
  }

  async castVote(electionId: string, actor: RequestUser, candidateId: string | null, request: Request) {
    const student = await this.resolveVotingStudent(actor)
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)

    if (!this.isVotingOpen(election)) {
      throw new ForbiddenException("Esta elección no está activa en este momento")
    }
    let resolvedCandidateId = candidateId
    if (candidateId === null) {
      if (!election.allowBlank) {
        throw new BadRequestException("Esta elección no permite voto en blanco")
      }
      const blank = election.candidates.find((c) => c.studentId === null)
      if (!blank) {
        throw new BadRequestException("Esta elección no tiene candidato de voto en blanco configurado")
      }
      resolvedCandidateId = blank.id
    } else if (!election.candidates.some((c) => c.id === candidateId)) {
      throw new BadRequestException("El candidato no pertenece a esta elección")
    }

    try {
      // El @@unique([electionId, studentId]) es lo que realmente garantiza
      // "exactamente un voto por estudiante" bajo concurrencia: si dos
      // peticiones simultáneas del mismo estudiante llegan a la vez, la BD
      // rechaza la segunda con una violación de unicidad (P2002), no una
      // condición de carrera resuelta a medias en la aplicación.
      await this.prisma.$transaction([
        this.prisma.electionVoter.create({
          data: { electionId, tenantId: actor.tenantId, studentId: student.id, ipAddress: request.ip },
        }),
        this.prisma.electionVote.create({
          data: { electionId, tenantId: actor.tenantId, candidateId: resolvedCandidateId! },
        }),
      ])
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ForbiddenException("Ya emitiste tu voto en esta elección")
      }
      throw e
    }

    return { status: "ok" as const }
  }

  // ─── Participación (Veedor/Rector) — nunca el escrutinio ─────────────────────

  async getParticipation(electionId: string, actor: RequestUser) {
    await this.findElectionOrThrow(electionId, actor.tenantId)

    const voters = await this.prisma.electionVoter.findMany({
      where: { electionId },
      select: { student: { select: { groupId: true, group: { select: { name: true, grade: true, section: true } } } } },
    })

    const eligibleTotal = await this.prisma.student.count({
      where: { tenantId: actor.tenantId, isActive: true },
    })

    const byGroup = new Map<string, { groupName: string; count: number }>()
    for (const v of voters) {
      const key = v.student.groupId ?? "sin-grupo"
      const groupName = v.student.group ? `${v.student.group.grade}${v.student.group.section}` : "Sin grupo"
      const entry = byGroup.get(key) ?? { groupName, count: 0 }
      entry.count += 1
      byGroup.set(key, entry)
    }

    return {
      votedCount: voters.length,
      eligibleTotal,
      byGroup: [...byGroup.values()],
    }
  }

  // ─── Resultados: nunca en vivo, solo tras CLOSED (managers) / PUBLISHED (todos) ─

  async getResults(electionId: string, actor: RequestUser) {
    const election = await this.findElectionOrThrow(electionId, actor.tenantId)

    if (election.status === ElectionStatus.PUBLISHED) {
      // cualquier miembro del tenant puede ver resultados publicados
    } else if (election.status === ElectionStatus.CLOSED) {
      // El escrutinio pre-publicación lo ve quien gestiona la elección. Se gatea
      // por permiso (ELECTIONS_MANAGE = "ver escrutinio") y no por roles fijos, para
      // que un rol personalizado con ese permiso también pueda verlo.
      if (!actor.permissions?.includes(PERMISSIONS.ELECTIONS_MANAGE)) {
        throw new ForbiddenException("Los resultados aún no se han publicado")
      }
    } else {
      throw new ForbiddenException("La votación sigue abierta; los resultados no están disponibles todavía")
    }

    const votes = await this.prisma.electionVote.groupBy({
      by: ["candidateId"],
      where: { electionId },
      _count: { candidateId: true },
    })
    const totalVotes = votes.reduce((sum, v) => sum + v._count.candidateId, 0)

    const candidates = await this.prisma.electionCandidate.findMany({
      where: { electionId },
      include: { student: { select: { firstName: true, lastName: true } } },
    })

    const results = candidates
      .map((c) => {
        const voteCount = votes.find((v) => v.candidateId === c.id)?._count.candidateId ?? 0
        return {
          candidateId: c.id,
          candidateNumber: c.candidateNumber,
          isBlank: c.studentId === null,
          name: c.student ? `${c.student.firstName} ${c.student.lastName}` : "Voto en blanco",
          slogan: c.slogan,
          voteCount,
          percentage: totalVotes > 0 ? Math.round((voteCount / totalVotes) * 1000) / 10 : 0,
        }
      })
      .sort((a, b) => b.voteCount - a.voteCount)

    return { status: election.status, totalVotes, results }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  // ACTIVE por sí solo no basta: si el Rector se olvida de cerrarla, seguiría
  // aceptando votos indefinidamente después de endDate. La ventana de fechas
  // manda tanto como el estado.
  private isVotingOpen(election: { status: ElectionStatus; startDate: Date; endDate: Date }): boolean {
    const now = new Date()
    return election.status === ElectionStatus.ACTIVE && now >= election.startDate && now <= election.endDate
  }

  private async findElectionOrThrow(electionId: string, tenantId: string) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: { candidates: { include: { student: { select: { firstName: true, lastName: true } } } } },
    })
    if (!election || election.tenantId !== tenantId) {
      throw new NotFoundException("Elección no encontrada")
    }
    return election
  }

  private async resolveVotingStudent(actor: RequestUser) {
    const student = await this.prisma.student.findFirst({
      // isActive: true → un estudiante retirado/graduado con login activo no puede
      // votar (y así votedCount nunca supera el total de elegibles, que sí filtra
      // por isActive en getParticipation).
      where: { userId: actor.id, tenantId: actor.tenantId, isActive: true },
      select: { id: true },
    })
    if (!student) {
      throw new ForbiddenException("Esta cuenta no tiene un perfil de estudiante activo")
    }
    return student
  }

  private assertTenant(actor: RequestUser): asserts actor is RequestUser & { tenantId: string } {
    if (!actor.tenantId) {
      throw new ForbiddenException("Se requiere un colegio para gestionar elecciones")
    }
  }
}
