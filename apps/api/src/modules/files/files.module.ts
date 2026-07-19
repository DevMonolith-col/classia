import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { AuditCoreModule } from "../../core/audit/audit-core.module";
import { FilesController } from "./files.controller";
import { FilesDataScopeGuard } from "./files-data-scope.guard";
import { FilesService } from "./files.service";

@Module({
  imports: [JwtModule.register({}), AuditCoreModule],
  controllers: [FilesController],
  providers: [JwtAuthGuard, PermissionsGuard, FilesService, FilesDataScopeGuard],
})
export class FilesModule {}
