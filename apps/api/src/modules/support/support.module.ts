import { Module } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { SupportController } from "./support.controller"
import { SupportService } from "./support.service"

@Module({
  imports: [JwtModule.register({})],
  controllers: [SupportController],
  providers: [JwtAuthGuard, PermissionsGuard, SupportService],
})
export class SupportModule {}
