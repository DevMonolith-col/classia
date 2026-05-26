import { Controller, Get } from "@nestjs/common";

@Controller("audit")
export class AuditController {
  @Get("status")
  status() {
    return {
      status: "audit-module-ready",
    };
  }
}
