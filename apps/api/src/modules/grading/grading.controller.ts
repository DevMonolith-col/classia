import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import { GradingService } from "./grading.service";
import {
  CreateScaleInput,
  ListCategoriesQuery,
  SetCategoriesInput,
  UpdateScaleInput,
  createScaleSchema,
  listCategoriesQuerySchema,
  setCategoriesSchema,
  updateScaleSchema,
} from "./grading.schemas";

// Escalas = config institucional (SUBJECTS_*). Categorías = del profesor que
// califica (MARKS_*), audiencia que ya incluye admin + profesor.
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GradingController {
  constructor(private readonly grading: GradingService) {}

  @Get("grading-scales")
  @Permissions(PERMISSIONS.SUBJECTS_READ)
  listScales(@CurrentUser() user: RequestUser, @Query("tenantId") tenantId?: string) {
    return this.grading.listScales(user, tenantId);
  }

  @Post("grading-scales")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  createScale(
    @Body(new ZodValidationPipe(createScaleSchema)) body: CreateScaleInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.grading.createScale(body, user, req);
  }

  @Patch("grading-scales/:id")
  @Permissions(PERMISSIONS.SUBJECTS_CREATE)
  updateScale(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateScaleSchema)) body: UpdateScaleInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.grading.updateScale(id, body, user, req);
  }

  @Get("grading-categories")
  @Permissions(PERMISSIONS.MARKS_LIST)
  listCategories(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listCategoriesQuerySchema)) query: ListCategoriesQuery,
  ) {
    return this.grading.listCategories(user, query);
  }

  @Post("grading-categories")
  @Permissions(PERMISSIONS.MARKS_CREATE)
  setCategories(
    @Body(new ZodValidationPipe(setCategoriesSchema)) body: SetCategoriesInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.grading.setCategories(body, user, req);
  }
}
