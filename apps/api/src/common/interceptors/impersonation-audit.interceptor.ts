import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditService } from "../../core/audit/audit.service";

// Campos que nunca deben quedar en la tabla de auditoría en claro. Si un
// supervisor cambia una contraseña u otro secreto mientras impersona, la
// auditoría guardaba el body crudo → el secreto quedaba persistido.
const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "currentpassword",
  "newpassword",
  "confirmpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
]);

// Devuelve `any` a propósito: el resultado alimenta el campo JSON de auditoría
// (Prisma.InputJsonValue), igual que el `request.body` (any) que reemplaza.
function redactSensitive(value: unknown): any {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitive(val);
    }
    return out;
  }
  return value;
}

@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    
    const request = context.switchToHttp().getRequest<Request>();
    
    return next.handle().pipe(
      tap(() => {
        // Log all mutations made during an impersonation session
        if (request.user?.isImpersonated && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
          this.audit.record({
            tenantId: request.tenant?.id,
            userId: request.user.id, // The SuperAdmin original ID
            actorRole: request.user.role,
            action: `impersonation.${request.method.toLowerCase()}`,
            entityType: "HttpRequest",
            entityId: request.url,
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
            newValues: {
              body: redactSensitive(request.body),
              query: redactSensitive(request.query),
            }
          }).catch(err => console.error("Failed to log impersonation audit", err));
        }
      })
    );
  }
}
