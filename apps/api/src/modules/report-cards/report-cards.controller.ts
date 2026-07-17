import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { ReportCardsService } from "./report-cards.service";
import {
  GenerateBulkInput,
  GenerateReportCardInput,
  ListReportCardsQuery,
  PreviewQuery,
  TranscriptQuery,
  generateBulkSchema,
  generateReportCardSchema,
  listReportCardsQuerySchema,
  previewQuerySchema,
  transcriptQuerySchema,
} from "./report-cards.schemas";

// Lectura con MARKS_LIST (profesor/estudiante/acudiente/admin, con scoping por rol
// dentro del servicio); generar con MARKS_CREATE (profesor + admin).
@Controller("report-cards")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportCardsController {
  constructor(private readonly reportCards: ReportCardsService) {}

  @Get()
  @Permissions(PERMISSIONS.MARKS_LIST)
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listReportCardsQuerySchema)) query: ListReportCardsQuery,
  ) {
    return this.reportCards.listCards(query.studentId, user, query.academicYearId);
  }

  // Definitiva en vivo (no persiste): periodId ausente = boletín anual.
  @Get("preview")
  @Permissions(PERMISSIONS.MARKS_LIST)
  preview(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(previewQuerySchema)) query: PreviewQuery,
  ) {
    return this.reportCards.compute(query.studentId, user, query.academicYearId, query.periodId);
  }

  // Histórico consolidado del año (todas las definitivas por materia).
  @Get("transcript")
  @Permissions(PERMISSIONS.MARKS_LIST)
  transcript(
    @CurrentUser() user: RequestUser,
    @Query("studentId") studentId: string,
    @Query(new ZodValidationPipe(transcriptQuerySchema)) query: TranscriptQuery,
  ) {
    return this.reportCards.compute(studentId, user, query.academicYearId, undefined);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.MARKS_LIST)
  findOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.reportCards.findCard(id, user);
  }

  @Post("generate-bulk")
  @Permissions(PERMISSIONS.MARKS_CREATE)
  generateBulk(
    @Body(new ZodValidationPipe(generateBulkSchema)) body: GenerateBulkInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.reportCards.generateBulk(body, user, req);
  }

  @Post("generate")
  @Permissions(PERMISSIONS.MARKS_CREATE)
  generate(
    @Body(new ZodValidationPipe(generateReportCardSchema)) body: GenerateReportCardInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.reportCards.generate(body, user, req);
  }
}
