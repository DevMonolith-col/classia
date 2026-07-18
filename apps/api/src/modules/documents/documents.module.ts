import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { DocumentsController } from "./documents.controller"
import { DocumentsProcessor } from "./documents.processor"
import { DOCUMENTS_QUEUE, DocumentsService } from "./documents.service"

@Module({
  imports: [BullModule.registerQueue({ name: DOCUMENTS_QUEUE })],
  controllers: [DocumentsController],
  providers: [JwtAuthGuard, PermissionsGuard, DocumentsService, DocumentsProcessor],
})
export class DocumentsModule {}
