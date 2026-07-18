import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AuditService } from "../../core/audit/audit.service";

@Injectable()
export class ImpersonationAuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
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
              body: request.body,
              query: request.query,
            }
          }).catch(err => console.error("Failed to log impersonation audit", err));
        }
      })
    );
  }
}
