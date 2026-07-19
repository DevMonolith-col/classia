import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common"
import { Request } from "express"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { Permissions } from "../../common/decorators/permissions.decorator"
import { AccessScope } from "@prisma/client"
import { DataScope } from "../../common/decorators/data-scope.decorator"
import { DataScopeGuard } from "../../common/guards/data-scope.guard"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { PERMISSIONS } from "../../common/permissions/permissions"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { RequestUser } from "../../common/types/request-context"
import { PaymentsService } from "./payments.service"
import {
  CreateFeeConceptInput,
  FinancialSummaryQuery,
  ListInvoicesQuery,
  RecordPaymentInput,
  createFeeConceptSchema,
  financialSummaryQuerySchema,
  listInvoicesQuerySchema,
  recordPaymentSchema,
} from "./payments.schemas"

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope(AccessScope.DATOS_PERSONALES)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("fee-concepts")
  @Permissions(PERMISSIONS.PAYMENTS_MANAGE)
  createFeeConcept(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(createFeeConceptSchema)) data: CreateFeeConceptInput,
  ) {
    return this.payments.createFeeConcept(user, data, request)
  }

  @Get("fee-concepts")
  @Permissions(PERMISSIONS.PAYMENTS_MANAGE)
  listFeeConcepts(@CurrentUser() user: RequestUser) {
    return this.payments.listFeeConcepts(user)
  }

  @Get("invoices")
  @Permissions(PERMISSIONS.PAYMENTS_MANAGE)
  listInvoices(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(listInvoicesQuerySchema)) query: ListInvoicesQuery) {
    return this.payments.listInvoices(user, query)
  }

  @Get("students/:studentId/balance")
  @Permissions(PERMISSIONS.PAYMENTS_READ_SELF)
  getStudentBalance(@Param("studentId") studentId: string, @CurrentUser() user: RequestUser) {
    return this.payments.getStudentBalance(studentId, user)
  }

  @Post("invoices/:id/payments")
  @Permissions(PERMISSIONS.PAYMENTS_MANAGE)
  recordPayment(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(recordPaymentSchema)) data: RecordPaymentInput,
  ) {
    return this.payments.recordPayment(id, user, data, request)
  }

  @Delete("invoices/:id")
  @Permissions(PERMISSIONS.PAYMENTS_MANAGE)
  cancelInvoice(@Param("id") id: string, @CurrentUser() user: RequestUser, @Req() request: Request) {
    return this.payments.cancelInvoice(id, user, request)
  }

  @Get("payments/summary")
  @Permissions(PERMISSIONS.PAYMENTS_MANAGE)
  getFinancialSummary(@CurrentUser() user: RequestUser, @Query(new ZodValidationPipe(financialSummaryQuerySchema)) query: FinancialSummaryQuery) {
    return this.payments.getFinancialSummary(user, query)
  }
}
