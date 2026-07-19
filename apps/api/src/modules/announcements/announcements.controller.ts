import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AccessScope } from "@prisma/client";
import { DataScope } from "../../common/decorators/data-scope.decorator";
import { DataScopeGuard } from "../../common/guards/data-scope.guard";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { RequestUser } from "../../common/types/request-context";
import {
  CreateAnnouncementInput,
  createAnnouncementSchema,
} from "./announcements.schemas";
import { AnnouncementsService } from "./announcements.service";

@Controller("announcements")
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.OPERATIVO)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @Permissions(PERMISSIONS.ANNOUNCEMENTS_LIST)
  list(@CurrentUser() user: RequestUser) {
    return this.announcements.listForUser(user);
  }

  @Get("groups")
  @Permissions(PERMISSIONS.ANNOUNCEMENTS_CREATE)
  targetGroups(@CurrentUser() user: RequestUser) {
    return this.announcements.listTargetGroups(user);
  }

  @Post()
  @Permissions(PERMISSIONS.ANNOUNCEMENTS_CREATE)
  create(
    @Body(new ZodValidationPipe(createAnnouncementSchema)) body: CreateAnnouncementInput,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.announcements.create(user, body, request);
  }

  @Post(":id/read")
  @Permissions(PERMISSIONS.ANNOUNCEMENTS_READ)
  markRead(@Param("id") announcementId: string, @CurrentUser() user: RequestUser) {
    return this.announcements.markRead(user, announcementId);
  }

  @Delete(":id")
  @Permissions(PERMISSIONS.ANNOUNCEMENTS_DELETE)
  remove(
    @Param("id") announcementId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.announcements.delete(user, announcementId, request);
  }
}
