import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { PERMISSIONS } from "../../common/permissions/permissions";
import { RequestUser } from "../../common/types/request-context";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @Permissions(PERMISSIONS.USERS_READ_SELF)
  me(@CurrentUser() user: RequestUser) {
    return this.users.findMe(user.id);
  }

  @Get("me/memberships")
  @Permissions(PERMISSIONS.USERS_READ_MEMBERSHIPS)
  memberships(@CurrentUser() user: RequestUser) {
    return this.users.findMyMemberships(user.id);
  }
}
