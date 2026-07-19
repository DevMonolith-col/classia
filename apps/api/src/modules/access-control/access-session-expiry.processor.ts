import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { Job } from "bullmq"
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

  constructor(private readonly accessControl: AccessControlService) {
    super()
  }

  async process(job: Job<{ accessSessionId?: string }>) {
    if (job.name === "expire-one" && job.data.accessSessionId) {
      const expired = await this.accessControl.expireSessionById(job.data.accessSessionId)
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
