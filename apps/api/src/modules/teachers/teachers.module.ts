import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { TeachersController } from "./teachers.controller";
import { TeachersService } from "./teachers.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [TeachersController],
  providers: [JwtAuthGuard, PermissionsGuard, TeachersService],
})
export class TeachersModule {}
