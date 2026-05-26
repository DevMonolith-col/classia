import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";

type ErrorResponseBody = {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  path: string;
  timestamp: string;
  stack?: string;
};

type HttpExceptionResponseBody = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly config?: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody = this.parseExceptionResponse(exceptionResponse);
    const nodeEnv = this.config?.get("app.nodeEnv") ?? "development";
    const includeStack = nodeEnv === "development" && exception instanceof Error;
    const body: ErrorResponseBody = {
      statusCode: status,
      error: responseBody.error ?? this.errorName(status),
      message:
        responseBody.message ??
        (exception instanceof HttpException
          ? exception.message
          : "Internal server error"),
      ...(responseBody.details ? { details: responseBody.details } : {}),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
      ...(includeStack ? { stack: exception.stack } : {}),
    };

    response.status(status).json(body);
  }

  private parseExceptionResponse(
    exceptionResponse: string | object | undefined,
  ): Partial<ErrorResponseBody> {
    if (typeof exceptionResponse === "string") {
      return {
        message: exceptionResponse,
      };
    }

    if (!this.isHttpExceptionResponseBody(exceptionResponse)) {
      return {};
    }

    return {
      ...(typeof exceptionResponse.error === "string"
        ? { error: exceptionResponse.error }
        : {}),
      ...(typeof exceptionResponse.message === "string" ||
      this.isStringArray(exceptionResponse.message)
        ? { message: exceptionResponse.message }
        : {}),
      ...("details" in exceptionResponse
        ? { details: exceptionResponse.details }
        : {}),
    };
  }

  private isHttpExceptionResponseBody(
    value: unknown,
  ): value is HttpExceptionResponseBody {
    return typeof value === "object" && value !== null;
  }

  private isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
  }

  private errorName(status: number) {
    return HttpStatus[status] ?? "Error";
  }
}
