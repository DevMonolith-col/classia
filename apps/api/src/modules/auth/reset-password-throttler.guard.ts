import { Injectable } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerRequest } from "@nestjs/throttler";

// 10 por minuto y por token: reintentos legítimos del mismo formulario.
const PER_TOKEN_LIMIT = 10;
const WINDOW_MS = 60_000;

/**
 * Rate limit de /auth/reset-password **por token**, no por IP.
 *
 * Es la otra mitad del mismo problema que ForgotPasswordThrottlerGuard: el onboarding masivo
 * no termina en "pedir el enlace", termina en "enviar el formulario con el token". Si esta ruta
 * se hubiera dejado con el ThrottlerGuard por IP (10/min), un colegio completando el flujo en
 * bloque desde la misma red se habría bloqueado igual, solo que un paso más tarde. El token es
 * de un solo uso y 32+ bytes aleatorios (auth.schemas.ts), así que trackear por token no abre
 * ninguna puerta nueva de fuerza bruta — cada intento real de adivinar un token ya viene de un
 * token distinto y falla la validación antes de importarle al throttle.
 *
 * El límite se fija acá y no en el `@Throttle()` de la ruta, por la misma razón que en
 * ForgotPasswordThrottlerGuard: el guard global por IP lee ese mismo decorador, y un solo
 * número para las dos dimensiones deja al colegio bloqueado por la de IP.
 */
@Injectable()
export class ResetPasswordThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    return super.handleRequest({ ...requestProps, limit: PER_TOKEN_LIMIT, ttl: WINDOW_MS });
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { token?: string } | undefined;
    const token = body?.token;
    if (token) return `reset-password:${token}`;
    // Sin token en el body (payload malformado) cae a IP para no dejar el endpoint sin límite
    // ante un cambio de contrato futuro.
    return `reset-password-ip:${String(req.ip ?? "unknown")}`;
  }
}
