import { SetMetadata } from "@nestjs/common";

export const PLATFORM_ROUTE_KEY = "platformRoute";

/**
 * Marca un controller (o una ruta suelta) como **de plataforma**: existe para operar Classia
 * entera, no para operar un colegio.
 *
 * Lo lee `JwtAuthGuard`, que bloquea a un `SUPER_ADMIN` que no esté impersonando en todo lo
 * que NO esté marcado así. La lista es explícita y corta a propósito, con el mismo criterio
 * que `GLOBAL_ALLOWLIST` en `scripts/verify-rls.ts`: **un módulo nuevo nace bloqueado**. Si
 * el criterio fuera "bloquear lo que sé que es de colegio", cada módulo que alguien agregue
 * después quedaría abierto sin que nadie lo decida.
 *
 * Antes de marcar uno nuevo, la pregunta no es "¿lo necesita el panel de superadmin?" sino
 * "¿esta ruta tiene sentido sin un colegio detrás?". Si la respuesta necesita un `tenantId`
 * para ser útil, no es de plataforma: el camino para llegar ahí es la impersonación, que
 * exige ticket y sesión de acceso aprobada (`auth.service#impersonate`).
 */
export const PlatformRoute = () => SetMetadata(PLATFORM_ROUTE_KEY, true);
