import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { ElectionStatus, Prisma, UserRole } from "@prisma/client"
import { Request } from "express"
import { RequestUser } from "../../common/types/request-context"
import { AuditService } from "../../core/audit/audit.service"
import { PrismaService } from "../../core/prisma/prisma.service"
import { AddCandidateInput, CreateElectionInput } from "./elections.schemas"

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
          ? { candidates: { create: [{ studentId: null, candidateNumber: 0, slogan: "Voto en blanco" }] } }
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
      include: { _count: { select: { candidates: true, voters: true } } },
    })
  }

  // Para el estudiante: solo lo que puede votar, sin el resto del panel de
  // gestión (que exige ELECTIONS_MONITOR, permiso que un estudiante no tiene).
  async listVotableElections(actor: RequestUser) {
    const student = await this.resolveVotingStudent(actor)

    const elections = await this.prisma.election.findMany({
      where: { tenantId: actor.tenantId, status: ElectionStatus.ACTIVE },
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

  async addCandidate(electionId: string, actor: RequestUser, data: AddCandidateInput) {
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

    try {
      return await this.prisma.electionCandidate.create({
        data: {
          electionId,
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

    if (election.status !== ElectionStatus.ACTIVE) {
      throw new ForbiddenException("Esta elección no está activa")
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

    if (election.status !== ElectionStatus.ACTIVE) {
      throw new ForbiddenException("Esta elección no está activa")
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
          data: { electionId, studentId: student.id, ipAddress: request.ip },
        }),
        this.prisma.electionVote.create({
          data: { electionId, candidateId: resolvedCandidateId! },
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
      if (actor.role !== UserRole.TENANT_ADMIN && actor.role !== UserRole.PRINCIPAL && actor.role !== UserRole.SUPER_ADMIN) {
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
      where: { userId: actor.id, tenantId: actor.tenantId },
      select: { id: true },
    })
    if (!student) {
      throw new ForbiddenException("Esta cuenta no tiene un perfil de estudiante")
    }
    return student
  }

  private assertTenant(actor: RequestUser): asserts actor is RequestUser & { tenantId: string } {
    if (!actor.tenantId) {
      throw new ForbiddenException("Se requiere un colegio para gestionar elecciones")
    }
  }
}
