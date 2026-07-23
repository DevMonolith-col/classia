import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Request } from "express";
import { Observable } from "rxjs";
import { TenantRlsContextService } from "../../core/prisma/tenant-rls-context.service";

// Arranca el contexto de tenant (AsyncLocalStorage) para el resto del
// request, a partir de request.user.tenantId. Va como interceptor y no
// como middleware porque el middleware corre ANTES que los guards —
// request.user recién existe después de JwtAuthGuard. Si no hay usuario
// autenticado (endpoints públicos: login, verificación de documentos,
// health) simplemente no hay contexto de tenant — las queries de esos
// endpoints no deberían tocar tablas con RLS forzado de todas formas.
@Injectable()
export class TenantRlsContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantRlsContext: TenantRlsContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.tenantRlsContext.runWithTenant(tenantId, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
