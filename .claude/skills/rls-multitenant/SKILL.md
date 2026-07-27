---
name: rls-multitenant
description: Procedimiento y trampas del aislamiento multi-tenant por Row-Level Security de Postgres en Classia. Úsalo al agregar o modificar un modelo de Prisma, escribir una migración, abrir una transacción, agregar un processor de BullMQ, necesitar una lectura cross-tenant, o al diagnosticar una query que devuelve cero filas sin razón aparente.
---

# Aislamiento multi-tenant con RLS

El aislamiento entre colegios no depende de que el código recuerde filtrar: hay **Row-Level
Security forzado en Postgres** sobre 46 tablas tenant-owned más 2 con `tenantId` nullable.
La app corre con un rol sin privilegios (`classia_app`) y cada query lleva
`app.tenant_id` seteado por transacción.

Consecuencia práctica: **RLS falla cerrado.** Cuando algo sale mal el síntoma no es una fuga
de datos, es "la feature devuelve cero filas" o "cero resultados sin error". Si estás
depurando eso, empieza por acá.

## Agregar un modelo tenant-owned

Prisma no genera políticas RLS — hay que escribirlas a mano. El orden importa:

1. **`tenantId` directo en el modelo**, no vía el padre. Aunque la tabla siempre se consulte
   a través de un padre ya filtrado, va `tenantId` propio: así todas las tablas comparten
   una política simple en vez de una política con JOIN distinta cada vez. Las 21 tablas de
   la Fase 1 se denormalizaron exactamente por esto.

   ```prisma
   tenantId String
   tenant   Tenant @relation(fields: [tenantId], references: [id])

   @@index([tenantId])
   ```

2. **Migración con la política.** `prisma migrate dev --create-only` para generar el archivo
   sin aplicarlo, y agregarle el bloque RLS. La forma estándar, idéntica para las 46 tablas:

   ```sql
   ALTER TABLE "mi_tabla" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "mi_tabla" FORCE ROW LEVEL SECURITY;
   DO $$ BEGIN
     CREATE POLICY tenant_isolation ON "mi_tabla"
       FOR ALL
       USING ("tenantId" = current_setting('app.tenant_id', true))
       WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
   EXCEPTION WHEN duplicate_object THEN null; END $$;
   ```

   `FORCE` no es opcional: sin él el dueño de la tabla ignora la política y esta existe en el
   schema sin proteger nada. `FOR ALL` con el mismo `USING` y `WITH CHECK` porque el criterio
   de aislamiento es el mismo para leer y escribir. El `DO/EXCEPTION` mantiene la migración
   idempotente, como el resto del repo.

3. **Actualizar los seeds** — exigen `tenantId` explícito desde la desnormalización.

4. **`pnpm verify:rls`.** El script no busca modelos con `tenantId`; parte de una lista blanca
   corta de lo que es genuinamente global y **falla por default** ante cualquier modelo nuevo
   sin clasificar. Ese criterio es deliberado: el enfoque opuesto es justo el que dejó pasar
   21 tablas. Si tu modelo falla, la respuesta correcta casi siempre es agregarle la política,
   no agregarlo a la lista blanca.

Un modelo **genuinamente global** (sin dueño de colegio) va en `GLOBAL_ALLOWLIST` en
`scripts/verify-rls.ts` **con una razón escrita**. Hoy son cuatro: `tenants`, `users`,
`system_settings`, `notification_preferences`. Agregar uno sin justificarlo es el opt-out
silencioso que el script existe para prevenir — si dudas, no es global.

## Transacciones

**Nunca `prisma.$transaction(...)` crudo.** Usa `runInTenantTransaction(prisma, tenantRlsContext, tenantId, async (tx) => {...})`
(`apps/api/src/core/prisma/run-in-tenant-transaction.ts`). El `tx` de adentro se usa igual que
el de `$transaction` — mismo callback interactivo, misma API.

El motivo: una transacción cruda corre en su propia conexión del pool, y la extensión de
Prisma solo puede setear `app.tenant_id` con `SET LOCAL` (por transacción) abriendo *otra*
mini-transacción, en una conexión distinta. Resultado: cero filas adentro de tu transacción.
Una regla de ESLint lo bloquea, con 3 excepciones auditadas — si te topas con ella, la salida
es el wrapper, no agregarte a la lista de excepciones.

Los `$queryRaw` **dentro** del wrapper heredan el contexto gratis (el `FOR UPDATE` de
`payments.service.ts` depende de esto). Los que están afuera, no.

## Jobs de BullMQ

Un processor corre sin request HTTP, así que nadie le setea el contexto. Los 6 que existen
(`notifications`, `documents`, `reports`, `access-session-expiry`, `event-reminders`,
`password-reset-cleanup`) lo resuelven con el mismo patrón: el `tenantId` viaja en `job.data`
desde que se encola, y el processor envuelve todo su trabajo:

```ts
async process(job: Job<{ deliveryId: string; tenantId: string }>) {
  return this.tenantRlsContext.runWithTenant(job.data.tenantId, () => this.doWork(job))
}
```

Si agregas un processor, encolar sin `tenantId` no falla ruidosamente — procesa cero filas.

**La excepción son los barridos periódicos**, que hoy son dos (`access-session-expiry` con
`job.name === "sweep"`, y `password-reset-cleanup` entero). No hay un colegio al que asociarlos,
así que el payload va vacío a propósito y el reparto es otro: el cliente de bypass **solo
descubre** las candidatas de todos los colegios (`select` mínimo, típicamente `id` y `tenantId`,
o `distinct: ["tenantId"]`), y el trabajo real de cada una corre dentro de
`runWithTenant(tenantId, ...)`. **El bypass abre la puerta a encontrarlas, no a tocarlas** — si
el `where` del barrido está mal, borra o cambia de menos, no de más. Un barrido que hace el
trabajo con el cliente de bypass es un bug esperando: RLS deja de ser la barrera de abajo.

Al escribirlo, dejá dicho en el processor que el payload va vacío a propósito; si no, el
siguiente que pase lo "arregla" agregándole un `tenantId` que no existe.

## Lectura cross-tenant

Hay dos salidas y se confunden fácil:

- **Ya sabes el tenant en ese punto del código** pero no hay request que lo haya seteado
  (un job, un handler de evento): `tenantRlsContext.runWithTenant(tenantId, ...)`. **Esta es
  la que necesitas el 90% de las veces.** En la auditoría de la Fase 2, la mayoría de los
  casos que parecían necesitar bypass eran esto.
- **Genuinamente necesitas ver todos los colegios a la vez** (dashboard agregado de
  `SUPER_ADMIN`, bandeja de triage de soporte, y el login/refresh — que corre sin JWT y por
  tanto sin ningún tenant conocido): `PlatformAdminPrismaService.get()`, un rol Postgres con
  `BYPASSRLS`. Es un getter y no una inyección directa a propósito: cada uso deja rastro de
  "necesité el bypass" y debe poder justificarse por el nombre del método.

Hay un tercer caso que parece el segundo y no lo es: **traducir una credencial a su tenant**.
Un endpoint autenticado por token en la URL (el feed ICS del calendario, `refresh`, `logout`)
tiene que buscar ese token en una tabla tenant-owned *para averiguar* el tenant, y eso es
circular: sin contexto la política devuelve cero filas, y el contexto sale justo de la fila que
no puede leer. La salida es el bypass **solo para ese lookup**, buscando por hash exacto y
devolviendo lo mínimo (id, tenant, usuario, revocación), y de ahí en adelante todo el trabajo
real adentro de `runWithTenant(tenantId, ...)`. Lo que no se hace nunca es leer los **datos**
con el bypass: si el token se filtra, RLS sigue siendo la barrera de abajo. Ver
`CalendarFeedService#resolveTokenAcrossTenants`, cuyo nombre existe para que el uso se
justifique solo.

## Diagnosticar "devuelve cero filas"

En orden de probabilidad:

1. `$transaction` crudo en el camino (o una llamada a un service que lo usa).
2. Job de BullMQ sin `tenantId` en el payload.
3. Código que corre fuera de request sin `runWithTenant`.
4. **Un test que lee la base directo con Prisma.** Es el caso 3, pero merece su propia línea
   porque en un test no se manifiesta como "cero filas": invierte la aserción sin avisar. Un
   `prisma.event.findUnique(...)` en un `it()` corre sin contexto, devuelve `null`, y entonces
   `expect(row?.deletedAt).toBeNull()` **pasa** — el test afirma exactamente lo contrario de lo
   que cree y queda verde para siempre. Las aserciones que van contra la base (no contra el
   API) van envueltas en `runWithTenant`, y conviene agregarles un `expect(row).not.toBeNull()`
   antes, para que la ausencia de contexto se vea. La suite de calendario pisó esto en tres
   tests el 2026-07-26; se detectó porque los tres fallaron a la vez con `Received: null`.
5. `DATABASE_URL_APP` mal configurada. Ojo con el inverso: si de repente **todo** funciona y
   ves filas de varios colegios, probablemente la app se conectó con `DATABASE_URL` (rol
   `classia`, superuser) — un superuser ignora RLS sin excepción y eso convierte todo el
   aislamiento en un no-op silencioso. Es el modo de falla más peligroso porque parece que
   funciona.

## El límite de lo que RLS defiende

**Un e2e de aislamiento cross-tenant prueba que RLS está activo, no que el código filtra.**
Se comprobó el 2026-07-26 en el módulo de calendario: quitándole el `where: { tenantId }` a
`list()` y a `findOne()`, los dos tests de aislamiento **siguieron pasando**. Con la política
forzada, la fila del otro colegio no existe para esa conexión, con `WHERE` o sin él — Postgres
tapa el error antes de que el filtro importe. Sirve como regresión de la garantía (si alguien
desactiva la política o la app se conecta con el rol superuser, se pone rojo), pero no cubre el
código.

Si querés un test que sí falle cuando el código se rompe, apuntá a lo que RLS **no** puede
producir: un `403` al pedir explícitamente otro tenant (`?tenantId=<ajeno>`), donde la
diferencia entre "403" y "200 con lista vacía" solo la puede decidir la aplicación. Y para el
scoping por rol dentro del mismo colegio —el grupo de otro profesor, el hijo de otro
acudiente— RLS no ayuda en absoluto: mismo `tenantId`, la política los deja pasar a los dos.
Esos tests sí fallan al revertir el chequeo, y son los que hay que escribir.

RLS protege contra "me olvidé el filtro". **No** protege contra "resolví el tenant
equivocado" río arriba, en el JWT o la sesión. Tampoco reemplaza el scoping por rol: que un
acudiente solo vea a sus hijos y un profesor solo sus grupos sigue siendo trabajo del código
(`apps/api/src/common/permissions/permissions.ts` y los `resolveOwnChildIds` de cada
service). Un test que pase RLS puede seguir teniendo un IDOR intra-tenant.

## Profundizar

`docs/planning/aislamiento-rls-multitenant.md` — las 7 trampas conocidas, cada una con la
prueba en vivo que la confirmó y por qué parecía inofensiva. Vale leerla completa antes de
cambiar el mecanismo mismo (la extensión, el wrapper, el contexto), no para el uso diario.

El test de regresión cross-tenant de la Fase 7 corre en cada push: es el que atrapa un
"filtré con el dato incorrecto", que ninguna política puede atrapar.
