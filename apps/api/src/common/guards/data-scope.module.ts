import { Module } from "@nestjs/common"
import { DataScopeGuard } from "./data-scope.guard"

// Deliberadamente separado de AccessControlModule (ver comentario en
// data-scope.guard.ts): así cualquier módulo puede usar @DataScope sin arrastrar
// la dependencia de NotificationsModule y sin riesgo de ciclo de imports.
@Module({
  providers: [DataScopeGuard],
  exports: [DataScopeGuard],
})
export class DataScopeModule {}
