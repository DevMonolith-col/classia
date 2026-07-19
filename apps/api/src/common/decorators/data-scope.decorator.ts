import { SetMetadata } from "@nestjs/common"
import { AccessScope } from "@prisma/client"

export const DATA_SCOPE_KEY = "dataScope"

// Marca un endpoint (o todo un controller) con el nivel de sensibilidad de lo que
// devuelve. Solo importa para requests en impersonación (ver DataScopeGuard): el
// propio personal de un colegio nunca queda restringido por esto.
export const DataScope = (scope: AccessScope) => SetMetadata(DATA_SCOPE_KEY, scope)
