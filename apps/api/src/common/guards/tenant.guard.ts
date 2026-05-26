import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { TenantContextService } from "../../core/tenant-context/tenant-context.service";

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenant = await this.tenantContext.resolveTenant(request);
    request.tenant = tenant;

    return true;
  }
}
