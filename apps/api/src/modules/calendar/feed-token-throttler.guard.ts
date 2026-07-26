import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Rate limit del feed ICS **por token**, no por IP.
 *
 * Por IP no sirve acá: los clientes que consumen el feed son los servidores de Google y de
 * Apple, así que todos los suscriptores de todos los colegios llegan desde un puñado de IPs
 * compartidas y un límite por IP castigaría a los legítimos sin frenar a nadie. Por token, en
 * cambio, cada suscripción tiene su propio cupo y el que abusa se limita solo.
 *
 * Es defensa en profundidad, no la barrera principal: el token son 32 bytes aleatorios y no
 * hay nada que enumerar. Lo que esto evita es que una URL filtrada se use para machacar el
 * endpoint.
 */
@Injectable()
export class FeedTokenThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const params = req.params as { token?: string } | undefined;
    if (params?.token) return `calendar-feed:${params.token}`;
    // Sin token en la ruta no hay nada que trackear por token; se cae a la IP para no dejar
    // el endpoint sin límite por un cambio de ruta futuro.
    return `calendar-feed-ip:${String(req.ip ?? "unknown")}`;
  }
}
