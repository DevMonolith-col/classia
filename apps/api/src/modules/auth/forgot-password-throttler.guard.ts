import { Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerRequest } from "@nestjs/throttler";

// 5 por minuto y por dirección: una persona pide su enlace una vez, quizá dos.
const PER_EMAIL_LIMIT = 5;
const WINDOW_MS = 60_000;

/**
 * Rate limit de /auth/forgot-password **por email**, no por IP.
 *
 * Por IP no sirve acá: cuando un colegio hace onboarding masivo (carga de CSV,
 * ver módulo `onboarding`), decenas de profesores/acudientes nuevos piden
 * "¿Olvidaste tu contraseña?" casi al mismo tiempo desde la misma red del
 * colegio. Un límite de 5/min por IP bloquearía al colegio entero a partir del
 * sexto intento aunque cada persona solo esté pidiendo su propio enlace una
 * vez. Por email, cada cuenta tiene su propio cupo y el ataque real (bombardear
 * la bandeja de una sola dirección) sigue limitado igual que antes.
 *
 * **El límite se fija acá, no en el `@Throttle()` de la ruta**, y esa separación es la que
 * hace que las dos dimensiones convivan. Desde que `ThrottlerGuard` es global (`APP_GUARD`),
 * sobre esta ruta corren DOS guards: este, que trackea por email, y el global, que trackea
 * por IP. Los dos leen el mismo `@Throttle()`, así que un único número los gobernaría a
 * ambos y el de la IP volvería a bloquear al colegio entero — medido en vivo antes de este
 * cambio: seis profesores distintos desde la misma red y el sexto ya recibía 429, justo el
 * caso que este guard existe para permitir. Con el límite estricto acá adentro, el
 * `@Throttle()` de la ruta queda libre para expresar solo el techo por IP.
 */
@Injectable()
export class ForgotPasswordThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    return super.handleRequest({ ...requestProps, limit: PER_EMAIL_LIMIT, ttl: WINDOW_MS });
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: string } | undefined;
    const email = body?.email?.trim().toLowerCase();
    if (email) return `forgot-password:${email}`;
    // Sin email en el body (payload malformado) cae a IP para no dejar el
    // endpoint sin límite ante un cambio de contrato futuro.
    return `forgot-password-ip:${String(req.ip ?? "unknown")}`;
  }
}
