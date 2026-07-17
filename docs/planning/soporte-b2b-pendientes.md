# Pendientes del Sistema de Soporte B2B y SaaS

Este documento recopila las tareas y funcionalidades que aún están pendientes para completar al 100% el ecosistema de Soporte Global y las configuraciones del SaaS. Lo revisaremos más adelante para priorizar los siguientes pasos.

## 1. Gestión de Roles y Equipo SaaS (Urgente)
- **Definición Estructural del Personal**: Aclarar a nivel de base de datos cómo se diferencian los roles globales (`SUPER_ADMIN`, `SUPPORT_AGENT`, etc.) del personal SaaS frente a los usuarios de los colegios. (¿Se añade un `globalRole` al modelo `User` en Prisma?).
- **Seeding de Usuarios**: Ejecutar el script pendiente para crear usuarios de prueba para el equipo SaaS (Gerente, Soporte Avanzado, etc.) de forma segura, para poder hacer las pruebas de asignación e *impersonation* con cuentas reales separadas.

## 2. Chat y Experiencia de Soporte
- **Mensajería en Tiempo Real**: Implementar el motor de WebSockets (que ya está aprobado en las reglas para el chat) en los comentarios de los tickets. Esto permitirá ver respuestas en vivo, "Soporte está escribiendo...", y checks de leído.
- **Archivos Adjuntos**: Permitir a los colegios subir capturas de pantalla de sus problemas (S3/R2) y visualizar las imágenes dentro del hilo del ticket.
- **Filtros Avanzados**: Poder filtrar tickets por colegio, prioridad o fecha de cierre en la bandeja global (`/superadmin/support`).

## 3. Notificaciones 
- **Integración Transaccional**: Conectar los endpoints de creación/actualización de tickets con el servicio de correos usando las credenciales SMTP que se configuren en la pestaña de `Configuración SaaS`.
- **Notificaciones In-App**: Enviar notificaciones a la campanita de la plataforma cuando un colegio reciba una respuesta o cuando un ticket sea reasignado.

## 4. UI / UX Adicional
- **Responsive Design Exhaustivo**: Asegurar que las vistas complejas (como la bandeja de entrada o las configuraciones) se comporten de manera ideal en dispositivos móviles pequeños, ya que vimos que la estructura de Layout tiene peculiaridades.
- **Dashboard Estadístico**: Agregar métricas rápidas (SLAs, tiempo medio de respuesta, tickets abiertos vs cerrados por agente) en `/superadmin`.
