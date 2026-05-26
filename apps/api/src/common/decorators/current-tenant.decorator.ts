import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { RequestTenant } from "../types/request-context";

export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestTenant | undefined => {
    const request = context.switchToHttp().getRequest<Request>();

    return request.tenant as RequestTenant | undefined;
  },
);
