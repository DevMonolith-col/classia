import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly config?: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const isProduction = this.config?.get("app.nodeEnv") === "production";
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    response.status(status).json({
      statusCode: status,
      error:
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null &&
        "error" in exceptionResponse
          ? exceptionResponse.error
          : HttpStatus[status],
      message:
        exception instanceof HttpException
          ? exception.message
          : "Internal server error",
      ...(isProduction || !(exception instanceof Error)
        ? {}
        : { stack: exception.stack }),
    });
  }
}
