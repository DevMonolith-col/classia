import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { AuditQueryService } from "./audit.service";
import { ListAuditLogsInput, listAuditLogsSchema } from "./audit.schemas";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get("status")
  status() {
    return {
      status: "audit-module-ready",
    };
  }

  @Get("logs")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AUDIT_READ)
  listLogs(
    @Query(new ZodValidationPipe(listAuditLogsSchema))
    query: ListAuditLogsInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.audit.list(query, user);
  }
}
