import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { BootstrapController } from "./bootstrap.controller";
import { BootstrapService } from "./bootstrap.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [BootstrapController],
  providers: [JwtAuthGuard, BootstrapService],
})
export class BootstrapModule {}
