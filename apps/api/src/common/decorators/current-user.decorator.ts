import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { RequestUser } from "../types/request-context";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestUser | undefined => {
    const request = context.switchToHttp().getRequest<Request>();

    return request.user as RequestUser | undefined;
  },
);
