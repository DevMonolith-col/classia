import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  imports: [AuditCoreModule, JwtModule.register({})],
  controllers: [UsersController],
  providers: [JwtAuthGuard, PermissionsGuard, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
