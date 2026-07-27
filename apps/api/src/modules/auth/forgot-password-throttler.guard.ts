import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

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
 */
@Injectable()
export class ForgotPasswordThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: string } | undefined;
    const email = body?.email?.trim().toLowerCase();
    if (email) return `forgot-password:${email}`;
    // Sin email en el body (payload malformado) cae a IP para no dejar el
    // endpoint sin límite ante un cambio de contrato futuro.
    return `forgot-password-ip:${String(req.ip ?? "unknown")}`;
  }
}
