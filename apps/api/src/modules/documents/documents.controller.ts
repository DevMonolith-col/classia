import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common"
import { Throttle, ThrottlerGuard } from "@nestjs/throttler"
import { AccessScope, DocumentType } from "@prisma/client"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { DataScope } from "../../common/decorators/data-scope.decorator"
import { Permissions } from "../../common/decorators/permissions.decorator"
import { DataScopeGuard } from "../../common/guards/data-scope.guard"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { PERMISSIONS } from "../../common/permissions/permissions"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { RequestUser } from "../../common/types/request-context"
import { DocumentsService } from "./documents.service"
import {
  IssueDocumentInput,
  PreviewTemplateInput,
  UpdateTemplateInput,
  issueDocumentSchema,
  previewTemplateSchema,
  updateTemplateSchema,
} from "./documents.schemas"

// Sin @UseGuards a nivel de clase: /verify/:code es pública a propósito
// (terceros externos verifican un PDF impreso sin login), el resto exige
// sesión + permiso caso por caso.
@Controller("documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  issue(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(issueDocumentSchema)) data: IssueDocumentInput) {
    return this.documents.issue(user, data)
  }

  @Get("mine")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_READ_SELF)
  listMine(@CurrentUser() user: RequestUser) {
    return this.documents.listMine(user)
  }

  @Get("templates/:type")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  getTemplate(@Param("type") type: DocumentType, @CurrentUser() user: RequestUser) {
    return this.documents.getTemplate(user, type)
  }

  @Put("templates/:type")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  updateTemplate(
    @Param("type") type: DocumentType,
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateTemplateSchema)) data: UpdateTemplateInput,
  ) {
    return this.documents.updateTemplate(user, type, data)
  }

  @Post("templates/:type/preview")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  previewTemplate(
    @Param("type") type: DocumentType,
    @Body(new ZodValidationPipe(previewTemplateSchema)) data: PreviewTemplateInput,
  ) {
    return this.documents.previewTemplate(type, data.contentHtml)
  }

  // Pública: un tercero (universidad, entidad) verifica un PDF impreso sin
  // sesión. No exponer nada que no vaya ya impreso en el propio documento.
  // Rate-limit por IP (defensa en profundidad contra enumeración del código).
  @Get("verify/:code")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Param("code") code: string) {
    return this.documents.verify(code)
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  list(@CurrentUser() user: RequestUser) {
    return this.documents.listForTenant(user)
  }

  @Get(":id/status")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  getStatus(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.documents.getStatus(id, user)
  }

  @Patch(":id/revoke")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  revoke(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.documents.revoke(id, user)
  }

  @Post(":id/retry")
  @UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
  @DataScope(AccessScope.DATOS_PERSONALES)
  @Permissions(PERMISSIONS.DOCUMENTS_MANAGE)
  retry(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.documents.retry(id, user)
  }
}
