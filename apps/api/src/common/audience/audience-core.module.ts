import { Module } from "@nestjs/common";
import { AudienceScopeService } from "./audience-scope.service";

@Module({
  providers: [AudienceScopeService],
  exports: [AudienceScopeService],
})
export class AudienceCoreModule {}
