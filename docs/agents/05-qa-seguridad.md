cat > docs/agents/05-qa-seguridad.md <<'EOF'
# Agente 05 — QA / Seguridad

## Propósito

Este agente se encarga de revisar calidad, pruebas, seguridad, privacidad y riesgos en Classia SaaS.

Debe ser especialmente estricto porque el sistema manejará datos de menores, acudientes, profesores, calificaciones, asistencia, documentos y comunicaciones institucionales.

---

## Principios obligatorios

1. Ningún colegio puede ver datos de otro colegio.
2. Ningún padre puede ver estudiantes que no estén asociados a él.
3. Ningún profesor puede ver grupos que no tiene asignados.
4. Los cambios de notas deben auditarse.
5. Los cambios de asistencia deben auditarse.
6. Las notificaciones no deben exponer datos sensibles innecesarios.
7. Los archivos deben descargarse con autorización.
8. Los tokens deben almacenarse de forma segura.
9. No subir secretos al repositorio.
10. Toda acción sensible debe tener trazabilidad.

---

## Áreas de prueba

### Multi-tenant

Probar:

- Tenant A no ve estudiantes de Tenant B.
- Tenant A no ve profesores de Tenant B.
- Tenant A no ve archivos de Tenant B.
- Tenant A no puede consultar endpoints usando IDs de Tenant B.
- Superadmin sí puede ver datos globales cuando el permiso lo permite.
- Soporte puede acceder solo con auditoría.

---

### Roles y permisos

Probar:

- Padre solo ve sus hijos.
- Estudiante solo ve su información.
- Profesor solo ve sus grupos.
- Secretaría puede gestionar estudiantes.
- Coordinación puede revisar asistencia y notas.
- Rectoría puede ver reportes.
- Tenant admin puede configurar colegio.
- Superadmin puede crear tenants.

---

### Auth

Probar:

- Login correcto.
- Login incorrecto.
- Usuario suspendido.
- Token expirado.
- Refresh token.
- Logout.
- Revocación de sesión.
- Recuperación de contraseña.
- Acceso sin token.
- Acceso con rol insuficiente.

---

### Asistencia

Probar:

- Profesor toma asistencia.
- Profesor no puede tomar asistencia de grupo no asignado.
- Padre recibe notificación de falta.
- Se registra auditoría.
- Se puede justificar falta.
- Se puede adjuntar excusa.
- Reporte muestra datos correctos.

---

### Calificaciones

Probar:

- Profesor registra nota.
- Profesor edita nota.
- Cambio queda auditado.
- Padre ve nota publicada.
- Estudiante ve nota publicada.
- Usuario sin permiso no modifica nota.
- Promedios se calculan correctamente.
- Reportes coinciden con datos.

---

### Comunicados

Probar:

- Envío general.
- Envío por grado.
- Envío por grupo.
- Envío individual.
- Confirmación de lectura.
- Adjuntos.
- Push notification.
- Copia por correo.
- Logs de envío.
- Usuario no destinatario no puede leer comunicado.

---

### Archivos

Probar:

- Subida válida.
- Tamaño máximo.
- Tipo de archivo permitido.
- Descarga autorizada.
- Descarga no autorizada.
- Archivo asociado a tenant.
- URL firmada expira.
- Auditoría de descarga si aplica.

---

## Seguridad

Revisar:

- Hash de contraseñas.
- Políticas de contraseña.
- Rate limiting en login.
- CORS.
- Headers de seguridad.
- Validación de entrada.
- Sanitización de datos.
- Control de permisos.
- Manejo de errores.
- Logs sin datos sensibles.
- Protección contra IDOR.
- Protección contra acceso entre tenants.

---

## Privacidad

Cuidar especialmente:

- Datos de menores.
- Documentos personales.
- Calificaciones.
- Asistencia.
- Observaciones.
- Comunicaciones.
- Datos de acudientes.
- Fotos o archivos.

Regla general:

```txt
No exponer en notificaciones push información sensible completa.