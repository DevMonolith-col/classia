import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  BulkCreateMarksInput,
  CreateMarkInput,
  ListMarksQuery,
  UpdateMarkInput,
  bulkCreateMarksSchema,
  createMarkSchema,
  listMarksQuerySchema,
  updateMarkSchema,
} from "./marks.schemas";
import { MarksService } from "./marks.service";

@Controller("marks")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarksController {
  constructor(private readonly marks: MarksService) {}

  @Get()
  @Permissions(PERMISSIONS.MARKS_LIST)
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listMarksQuerySchema)) query: ListMarksQuery,
  ) {
    return this.marks.list(user, query);
  }

  @Get(":id")
  @Permissions(PERMISSIONS.MARKS_READ)
  findOne(@Param("id") markId: string, @CurrentUser() user: RequestUser) {
    return this.marks.findOne(markId, user);
  }

  @Post()
  @Permissions(PERMISSIONS.MARKS_CREATE)
  create(
    @Body(new ZodValidationPipe(createMarkSchema)) body: CreateMarkInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.marks.create(body, user, request);
  }

  @Post("bulk")
  @Permissions(PERMISSIONS.MARKS_CREATE)
  bulkCreate(
    @Body(new ZodValidationPipe(bulkCreateMarksSchema)) body: BulkCreateMarksInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.marks.bulkCreate(body, user, request);
  }

  @Patch(":id")
  @Permissions(PERMISSIONS.MARKS_UPDATE)
  update(
    @Param("id") markId: string,
    @Body(new ZodValidationPipe(updateMarkSchema)) body: UpdateMarkInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.marks.update(markId, body, user, request);
  }
}
