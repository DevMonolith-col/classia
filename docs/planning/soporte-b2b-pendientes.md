# Pendientes del Sistema de Soporte B2B y SaaS

> **Corrección del 2026-07-19**: verificado contra el código actual. La mayoría de
> §1 y §2 ya está construida — se marca abajo. Lo que sigue realmente pendiente:
> integración de email transaccional para tickets (§3, confirmado que
> `support.service.ts` no llama a `NotificationsService`/`EmailService` en ningún
> punto), notificaciones in-app de soporte (§3), dashboard estadístico (§4), y
> responsive exhaustivo (§4, no verificable por grep, requiere revisión manual).

Este documento recopila las tareas y funcionalidades que aún están pendientes para completar al 100% el ecosistema de Soporte Global y las configuraciones del SaaS. Lo revisaremos más adelante para priorizar los siguientes pasos.

## 1. Gestión de Roles y Equipo SaaS (Urgente)
- ~~**Definición Estructural del Personal**~~ — ✅ Resuelto de forma distinta a lo
  planteado: no se agregó un `globalRole` a `User`, se agregó `SUPPORT_SUPERVISOR`
  como `UserRole` de plataforma propio (junto a `SUPER_ADMIN`/`SUPPORT_AGENT`),
  unificados en `PLATFORM_ROLES` (`users.service.ts`).
- ~~**Seeding de Usuarios**~~ — ✅ Hecho (`feat(seed): add real support supervisor and agent accounts`).

## 2. Chat y Experiencia de Soporte
- ~~**Mensajería en Tiempo Real**~~ — ✅ Hecho: `support.gateway.ts` (WebSocketGateway
  + socket.io), incluye "escribiendo..." (verificado con hallazgo de auditoría
  menor sobre falta de check de sala, ver `auditoria-seguridad-2026-07.md`).
- ~~**Archivos Adjuntos**~~ — ✅ Hecho (`attachmentKey` en `support.schemas.ts`).
- ~~**Filtros Avanzados**~~ — ✅ Al menos filtro por estado hecho en
  `/superadmin/support`; no verificado si incluye colegio/prioridad/fecha de cierre.

## 3. Notificaciones — PENDIENTE
- **Integración Transaccional**: sigue sin conectar; `support.service.ts` no emite
  ningún evento de notificación ni llama a `EmailService`.
- **Notificaciones In-App**: sigue sin conectar, mismo motivo.

## 4. UI / UX Adicional — PENDIENTE
- **Responsive Design Exhaustivo**: sin verificar.
- **Dashboard Estadístico**: sin evidencia de implementación.
