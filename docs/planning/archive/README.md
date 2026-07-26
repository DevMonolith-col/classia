# Archivo — planning histórico

Documentos de planeación **completamente superados**, movidos aquí el 2026-07-19
para que `docs/planning/` refleje solo trabajo activo o de referencia vigente.
Ninguno de estos describe pendientes reales — o ya está construido, o fue
reemplazado por un documento más nuevo. Se conservan por valor histórico
("cómo llegamos hasta acá"), no para saber qué falta.

| Documento | Por qué está aquí |
|---|---|
| `roadmap-prototype-2.md` | Ya reemplazado por `../estado-del-proyecto.md` desde antes de esta limpieza (nota propia del documento) |
| `backend-v1-plan.md` | Planeación del arranque del backend (2026-05-26); superado por todo lo construido desde entonces |
| `especificacion-tecnica.md` | Backlog inicial para repartir en issues; ese backlog ahora vive en el tablero de GitHub Projects |
| `image_support_completion.md` | Reporte puntual de un incidente de build ya resuelto, no un plan |
| `SuperAdmin-v1-plan.md` | Plan del primer incremento visual de SuperAdmin; superado por el sistema de soporte B2B completo |

## Los cinco briefs de `docs/agents/` (archivados el 2026-07-25)

`docs/agents/` era un brief de diseño escrito **antes** de existir el código, con un
archivo por cargo (arquitecto, backend, database, frontend, QA). Se archivó completo
por dos razones. La primera es que había derivado hasta ser falso: describía módulos,
entidades y una app móvil que no coinciden con el repo. La segunda es más de fondo —
cortar el contexto por cargo es el corte equivocado. Quien toca un endpoint de pagos
necesita a la vez el gotcha de `runInTenantTransaction`, el patrón de guards y el
contrato de `Mark`; repartidos en tres archivos por rol, se cargan los tres quintos
que no aplican. El contexto se corta por **cuándo se necesita**, no por quién lo haría.

Lo transversal que sobrevivió vive ahora en `CLAUDE.md` (unas 15 líneas, no 13.7 KB),
y lo específico por tarea pasa a skills en `.claude/skills/`, que cargan solo cuando
aplican.

| Documento | Por qué está aquí |
|---|---|
| `01-arquitecto-saas.md` | Mandaba la app móvil "desde la primera versión profesional" (nunca se inicializó — sigue en roadmap, ver `../estado-del-proyecto.md` §6) y describía el aislamiento como "separación lógica por `tenant_id`", muy por detrás del RLS con 3 roles de Postgres que hay hoy |
| `02-backend-api.md` | Su árbol de módulos listaba `roles/` y `assignments/` (no existen; el RBAC es `permissions.ts` y es `homework`) y omitía ~15 módulos reales. Dejaba abierto "Zod **o** class-validator", decisión ya tomada a favor de Zod |
| `03-database-prisma.md` | Sus 40 "entidades esperadas" eran un schema imaginario (`messages`, `message_threads`, `push_tokens`, `billing_subscriptions`, `campuses`…). Su principio 4 pedía constraints únicos, y el bug conocido de `Mark` es justamente uno faltante: un principio sin mecanismo no se cumple |
| `04-frontend-mobile.md` | Casi entero sobre la app Expo que no existe; el stack web que listaba tampoco coincidía (mencionaba React Hook Form y Framer Motion, omitía shadcn/ui y Next 16) |
| `05-qa-seguridad.md` | Sus checklists enumeraban lo obvio ("probar login correcto, login incorrecto"). Lo que sí valía ya está mejor expresado como código ejecutable: el test de regresión cross-tenant de la Fase 7 y `pnpm verify:rls` |

Para lo que sí sigue pendiente, ver `../estado-del-proyecto.md` §6 y el tablero de
GitHub Projects.
