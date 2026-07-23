import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { Job } from "bullmq"
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service"
import { AccessControlService, ACCESS_SESSION_EXPIRY_QUEUE } from "./access-control.service"

// Worker de la cola de expiración de AccessSession, con dos tipos de job
// registrados en la misma cola (se distinguen por job.name):
//  - "expire-one": job diferido puntual programado por AccessControlService al
//    conceder una sesión (approve/breakGlass), con delay = su ventana real.
//  - "sweep": barrido periódico repetible registrado en
//    AccessControlModule#onModuleInit, red de seguridad para lo que el job
//    puntual se pierda.
// Ambos llaman a la misma lógica idempotente del service (expireSessionById /
// expireOverdueSessions), así que no importa cuál gane la carrera sobre una
// fila dada.
@Processor(ACCESS_SESSION_EXPIRY_QUEUE)
export class AccessSessionExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(AccessSessionExpiryProcessor.name)

  constructor(
    private readonly accessControl: AccessControlService,
    private readonly tenantRlsContext: TenantRlsContextService,
  ) {
    super()
  }

  async process(job: Job<{ accessSessionId?: string; tenantId?: string }>) {
    // "expire-one" es puntual por sesión -- el tenantId viaja en job.data
    // desde que se programó (ver access-control.service.ts#scheduleExpiryJob).
    // "sweep" es genuinamente cross-tenant (docs/planning/aislamiento-rls-multitenant.md,
    // Fase 6) -- expireOverdueSessions() maneja su propio contexto por
    // candidata internamente, no hace falta establecer nada acá.
    if (job.name === "expire-one" && job.data.accessSessionId && job.data.tenantId) {
      const expired = await this.tenantRlsContext.runWithTenant(job.data.tenantId, () =>
        this.accessControl.expireSessionById(job.data.accessSessionId!),
      )
      if (expired) {
        this.logger.log(`Job puntual: AccessSession ${job.data.accessSessionId} marcada EXPIRADO.`)
      }
      return { expired }
    }

    const result = await this.accessControl.expireOverdueSessions()
    if (result.expiredSessions > 0) {
      this.logger.log(`Barrido de expiración: ${result.expiredSessions} AccessSession marcadas EXPIRADO.`)
    }
    return result
  }
}
