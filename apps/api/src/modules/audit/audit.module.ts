import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditController } from "./audit.controller";
import { AuditQueryService } from "./audit.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuditController],
  providers: [AuditQueryService, JwtAuthGuard, PermissionsGuard],
})
export class AuditModule {}
