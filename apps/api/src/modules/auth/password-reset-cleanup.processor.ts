import { Processor, WorkerHost } from "@nestjs/bullmq";
import {
  PASSWORD_RESET_CLEANUP_QUEUE,
  PasswordResetCleanupService,
} from "./password-reset-cleanup.service";

/**
 * Worker del barrido de tokens de restablecimiento vencidos. Un solo tipo de job repetible
 * (`sweep`), registrado en `PasswordResetCleanupModule#onModuleInit`.
 *
 * **El payload va vacío a propósito.** La regla general para los processors de este repo es que
 * el `tenantId` viaje en `job.data` desde que se encola, porque un worker corre sin request y
 * sin contexto de tenant RLS devuelve cero filas en silencio. Acá no aplica: no hay un colegio
 * al que asociar el job, y el servicio descubre por sí mismo cuáles tienen filas viejas y abre
 * el contexto de cada uno. Queda escrito para que nadie "arregle" el payload faltante.
 */
@Processor(PASSWORD_RESET_CLEANUP_QUEUE)
export class PasswordResetCleanupProcessor extends WorkerHost {
  constructor(private readonly cleanup: PasswordResetCleanupService) {
    super();
  }

  async process() {
    return this.cleanup.purgeExpiredTokens();
  }
}
