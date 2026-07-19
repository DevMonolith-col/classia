import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common"
import { Request } from "express"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { RequestUser } from "../../common/types/request-context"
import { AccessControlService } from "./access-control.service"
import {
  BreakGlassInput,
  DenyAccessInput,
  RequestAccessInput,
  RevokeAccessInput,
  breakGlassSchema,
  denyAccessSchema,
  requestAccessSchema,
  revokeAccessSchema,
} from "./access-control.schemas"

@Controller("access-sessions")
@UseGuards(JwtAuthGuard)
export class AccessControlController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Post()
  request(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(requestAccessSchema)) data: RequestAccessInput,
  ) {
    return this.accessControl.requestAccess(data, user, request)
  }

  @Patch(":id/approve")
  approve(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.accessControl.approve(id, user, request)
  }

  @Patch(":id/deny")
  deny(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(denyAccessSchema)) data: DenyAccessInput,
  ) {
    return this.accessControl.deny(id, data, user, request)
  }

  @Patch(":id/revoke")
  revoke(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(revokeAccessSchema)) data: RevokeAccessInput,
  ) {
    return this.accessControl.revoke(id, data, user, request)
  }

  @Post("break-glass")
  breakGlass(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(breakGlassSchema)) data: BreakGlassInput,
  ) {
    return this.accessControl.breakGlass(data, user, request)
  }

  @Get("active")
  active(@CurrentUser() user: RequestUser) {
    return this.accessControl.getActiveForCurrentUser(user)
  }

  @Get()
  forTicket(@Query("ticketId") ticketId: string, @CurrentUser() user: RequestUser) {
    return this.accessControl.listForTicket(ticketId, user)
  }
}
