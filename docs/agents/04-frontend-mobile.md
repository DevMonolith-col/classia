
---

## 4. Agente Frontend / Mobile

```bash
cat > docs/agents/04-frontend-mobile.md <<'EOF'
# Agente 04 — Frontend Web / Mobile

## Propósito

Este agente mantiene consistencia en la experiencia web y móvil de Classia SaaS.

Debe cuidar que la plataforma sea profesional, clara, usable y coherente para directivos, administrativos, profesores, padres y estudiantes.

---

## Stack web

- Next.js.
- TypeScript.
- Tailwind CSS.
- React Hook Form.
- Zod.
- TanStack Query.
- Componentes reutilizables.
- Framer Motion de forma moderada.

---

## Stack mobile

- React Native.
- Expo.
- TypeScript.
- Expo Router.
- Expo Notifications.
- Secure Store.
- TanStack Query.
- Componentes reutilizables.

---

## Principios de producto

1. La web es para administración pesada.
2. La app móvil es para acciones rápidas.
3. No replicar exactamente la web en mobile.
4. Cada rol debe ver solo lo que necesita.
5. La interfaz debe ser clara para usuarios no técnicos.
6. Evitar saturar con información.
7. Priorizar velocidad en flujos frecuentes.
8. Mantener una identidad visual institucional y moderna.
9. Mostrar estados de carga, vacío y error.
10. Validar formularios antes de enviar.

---

## Experiencia web

La web debe incluir:

- Landing comercial.
- Panel interno SaaS.
- Panel administrativo del colegio.
- Panel para profesores.
- Panel para padres.
- Panel para estudiantes.

El panel administrativo debe permitir tareas complejas:

- Carga de estudiantes.
- Gestión de horarios.
- Configuración académica.
- Reportes.
- Gestión de usuarios.
- Auditoría.

---

## Experiencia mobile

La app móvil debe resolver acciones frecuentes.

### Padre/acudiente

- Ver hijos.
- Ver tareas.
- Ver notas.
- Ver asistencia.
- Recibir comunicados.
- Confirmar lectura.
- Subir excusas.
- Ver calendario.
- Recibir notificaciones.

### Profesor

- Ver horario del día.
- Ver grupos.
- Tomar asistencia rápido.
- Crear tareas.
- Registrar notas.
- Enviar comunicados.
- Revisar entregas.
- Recibir notificaciones.

### Estudiante

- Ver horario.
- Ver tareas.
- Subir entregas.
- Ver notas.
- Ver comunicados.
- Ver calendario.

---

## Diseño visual

Classia debe sentirse:

- Profesional.
- Institucional.
- Moderna.
- Clara.
- Confiable.
- No infantil.
- Fácil de usar.

Evitar:

- Diseños demasiado cargados.
- Colores excesivamente brillantes.
- Animaciones innecesarias.
- Interfaces confusas.
- Textos técnicos para padres.

---

## Componentes recomendados

- Button.
- Input.
- Select.
- Modal.
- Card.
- Badge.
- Table.
- DataTable.
- EmptyState.
- LoadingState.
- ErrorState.
- PageHeader.
- RoleGuard.
- TenantBadge.
- ConfirmDialog.
- FileUploader.

---

## Estados obligatorios

Toda pantalla que consulte datos debe manejar:

- Loading.
- Error.
- Empty.
- Success.
- Unauthorized.
- Forbidden cuando aplique.

---

## Consumo de API

Reglas:

1. No duplicar tipos si ya existen en packages/shared.
2. Usar validaciones compartidas si aplica.
3. Centralizar cliente HTTP.
4. Manejar refresh token de forma segura.
5. No guardar datos sensibles innecesarios en localStorage.
6. En mobile, usar Secure Store para tokens sensibles.
7. Mostrar mensajes de error comprensibles.

---

## Accesibilidad

Cuidar:

- Contraste.
- Tamaño de texto.
- Labels en formularios.
- Botones fáciles de tocar en mobile.
- Navegación clara.
- Estados visuales de foco.
- Mensajes de error claros.

---

## Landing comercial

La landing debe vender beneficios, no solo módulos.

Debe hablarle a:

- Directivos.
- Profesores.
- Padres.
- Administrativos.

Secciones sugeridas:

- Hero.
- Problema.
- Solución.
- Módulos.
- App móvil.
- Seguridad.
- Demo.
- Contacto.
- Preguntas frecuentes.

---

## Criterios de aceptación

Una pantalla está lista cuando:

- Es responsive si es web.
- Tiene estados loading/error/empty.
- Valida formularios.
- Respeta permisos.
- Consume API correctamente.
- No muestra datos de otro tenant.
- Es clara para el rol objetivo.
- Está alineada con la identidad visual de Classia.
EOF