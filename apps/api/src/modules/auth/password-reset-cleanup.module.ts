import { BullModule, InjectQueue } from "@nestjs/bullmq";
import { Module, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import { buildJobId } from "../../core/queue/job-id";
import { PasswordResetCleanupProcessor } from "./password-reset-cleanup.processor";
import {
  CLEANUP_SWEEP_INTERVAL_MS,
  PASSWORD_RESET_CLEANUP_QUEUE,
  PasswordResetCleanupService,
} from "./password-reset-cleanup.service";

/**
 * Módulo propio y no parte de `AuthModule`, a propósito.
 *
 * `AuthModule` importa `EmailModule` en vez de `NotificationsModule` justamente para **no atar
 * el arranque de la autenticación a Redis** (ver el comentario de `email.module.ts`). Registrar
 * acá la cola habría deshecho esa decisión por un barrido que no tiene nada que ver con atender
 * un login.
 *
 * (Nota para quien audite: hoy `AuthModule` importa además `AccessControlModule`, que sí
 * registra una cola, así que el desacople ya no es total. Eso no es motivo para empeorarlo.)
 */
@Module({
  imports: [BullModule.registerQueue({ name: PASSWORD_RESET_CLEANUP_QUEUE })],
  providers: [PasswordResetCleanupService, PasswordResetCleanupProcessor],
  exports: [PasswordResetCleanupService],
})
export class PasswordResetCleanupModule implements OnModuleInit {
  constructor(@InjectQueue(PASSWORD_RESET_CLEANUP_QUEUE) private readonly queue: Queue) {}

  // jobId estable: si el proceso se reinicia, BullMQ reconoce el scheduler repetible como el
  // mismo y no crea otro en paralelo. Pasa por `buildJobId` porque BullMQ rechaza ":" en un
  // jobId personalizado, y ese es el único lugar que decide el separador.
  async onModuleInit() {
    await this.queue.add(
      "sweep",
      {},
      {
        repeat: { every: CLEANUP_SWEEP_INTERVAL_MS },
        jobId: buildJobId("password-reset-cleanup-sweep"),
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }
}
