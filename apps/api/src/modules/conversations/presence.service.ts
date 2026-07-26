import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../../core/redis/redis.service";

/**
 * Presencia de usuarios conectados (docs/planning/chat-tiempo-real.md, Fase 4).
 *
 * Vive **en Redis y no en Postgres** a propósito: es un dato de altísima escritura (cada
 * conexión, cada desconexión, un heartbeat por minuto y por persona) y completamente efímero.
 * Perderlo en un reinicio de Redis degrada a "sin información", que es exactamente lo correcto;
 * escribirlo en Postgres sería castigar la base por un dato que no importa mañana.
 *
 * Un `Set` por colegio en vez de preguntarle al adaptador quién está conectado: pintar una
 * lista de 60 contactos con `io.in(...).allSockets()` son 60 idas y vueltas a Redis, y con el
 * Set es una.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  /**
   * Margen del heartbeat. Es el que cubre el caso feo: el navegador que muere sin `disconnect`
   * limpio —cerrar la laptop, perder la red— y sin el cual esa persona queda "en línea" para
   * siempre. El cliente late cada 30 s; 90 s tolera un latido perdido sin apagar a alguien que
   * sigue ahí.
   */
  private static readonly HEARTBEAT_TTL_SECONDS = 90;

  constructor(private readonly redis: RedisService) {}

  /** Marca al usuario como conectado. Devuelve true si **pasó** de offline a online. */
  async connect(tenantId: string, userId: string): Promise<boolean> {
    try {
      // `sadd` devuelve 1 solo si no estaba: así se distingue "abrió una segunda pestaña" de
      // "acaba de llegar", y no se avisa a sus contactos por cada pestaña.
      const added = await this.redis.client.sadd(this.setKey(tenantId), userId);
      await this.touch(tenantId, userId);
      return added === 1;
    } catch (error) {
      this.logger.warn(`No se pudo registrar la presencia de ${userId}: ${(error as Error).message}`);
      return false;
    }
  }

  /** Refresca el TTL del heartbeat. */
  async touch(tenantId: string, userId: string): Promise<void> {
    try {
      await this.redis.client.setex(
        this.heartbeatKey(userId),
        PresenceService.HEARTBEAT_TTL_SECONDS,
        tenantId,
      );
    } catch (error) {
      this.logger.warn(`No se pudo refrescar el heartbeat de ${userId}: ${(error as Error).message}`);
    }
  }

  /**
   * Marca al usuario como desconectado y guarda cuándo se lo vio por última vez.
   * Devuelve true si de verdad quedó offline.
   */
  async disconnect(tenantId: string, userId: string, remainingSockets: number): Promise<boolean> {
    // Una pestaña cerrada no es una persona desconectada: solo cuenta el último socket.
    if (remainingSockets > 0) return false;

    try {
      await this.redis.client.srem(this.setKey(tenantId), userId);
      await this.redis.client.del(this.heartbeatKey(userId));
      await this.redis.client.set(this.lastSeenKey(userId), new Date().toISOString());
      return true;
    } catch (error) {
      this.logger.warn(`No se pudo limpiar la presencia de ${userId}: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Quiénes de esos usuarios están en línea, y cuándo se vio por última vez a los que no.
   *
   * Se cruza el Set con el heartbeat: alguien puede haber quedado en el Set por un cierre sucio
   * y su heartbeat ya expiró — ahí manda el heartbeat, y de paso se limpia el Set.
   */
  async statusOf(
    tenantId: string,
    userIds: string[],
  ): Promise<Record<string, { online: boolean; lastSeenAt: string | null }>> {
    const result: Record<string, { online: boolean; lastSeenAt: string | null }> = {};
    if (userIds.length === 0) return result;

    try {
      const inSet = new Set(await this.redis.client.smembers(this.setKey(tenantId)));

      const pipeline = this.redis.client.pipeline();
      for (const userId of userIds) {
        pipeline.exists(this.heartbeatKey(userId));
        pipeline.get(this.lastSeenKey(userId));
      }
      const replies = (await pipeline.exec()) ?? [];

      const rancios: string[] = [];
      userIds.forEach((userId, index) => {
        const alive = Number(replies[index * 2]?.[1] ?? 0) === 1;
        const lastSeenAt = (replies[index * 2 + 1]?.[1] as string | null) ?? null;
        const online = inSet.has(userId) && alive;

        if (inSet.has(userId) && !alive) rancios.push(userId);
        result[userId] = { online, lastSeenAt };
      });

      if (rancios.length > 0) {
        await this.redis.client.srem(this.setKey(tenantId), ...rancios);
      }

      return result;
    } catch (error) {
      // La presencia es decorativa: si Redis no responde, todos figuran offline en vez de
      // romper la carga de la bandeja.
      this.logger.warn(`No se pudo leer la presencia: ${(error as Error).message}`);
      for (const userId of userIds) result[userId] = { online: false, lastSeenAt: null };
      return result;
    }
  }

  private setKey(tenantId: string) {
    return `presence:${tenantId}`;
  }

  private heartbeatKey(userId: string) {
    return `presence:hb:${userId}`;
  }

  private lastSeenKey(userId: string) {
    return `presence:seen:${userId}`;
  }
}
