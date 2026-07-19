import { Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { Job } from "bullmq"
import { AccessControlService, ACCESS_SESSION_EXPIRY_QUEUE } from "./access-control.service"

// Worker del barrido periódico registrado en AccessControlModule#onModuleInit.
// La lógica real vive en AccessControlService#expireOverdueSessions (idempotente
// por diseño); este processor solo la invoca y registra el resultado.
@Processor(ACCESS_SESSION_EXPIRY_QUEUE)
export class AccessSessionExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(AccessSessionExpiryProcessor.name)

  constructor(private readonly accessControl: AccessControlService) {
    super()
  }

  async process(_job: Job) {
    const result = await this.accessControl.expireOverdueSessions()
    if (result.expiredSessions > 0) {
      this.logger.log(
        `Barrido de expiración: ${result.expiredSessions} AccessSession marcadas EXPIRADO, ${result.revokedAuthSessions} AuthSession revocadas.`,
      )
    }
    return result
  }
}
