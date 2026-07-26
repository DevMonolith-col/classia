// Serialización iCalendar (RFC 5545) para el feed suscribible del calendario.
//
// Función pura, sin Prisma ni Nest: recibe ítems ya autorizados y devuelve el texto. Todo lo
// que decide QUÉ va adentro vive en calendar-feed.service.ts; acá solo se decide CÓMO se
// escribe. Se hace a mano y sin dependencia porque son ~100 líneas y las librerías de ICS
// traen mucho más de lo que hace falta (recurrencia, timezones, alarmas).
//
// Los cuatro detalles que hay que hacer bien a la primera, porque equivocarse se ve como
// eventos duplicados en el calendario de una familia y no como un error:
//
//   1. UID estable por ítem. Si cambia entre dos lecturas, el cliente no reconoce el evento
//      y lo agrega de nuevo en vez de actualizarlo.
//   2. SEQUENCE creciente. Es lo que le dice al cliente "esto es una versión más nueva del
//      mismo evento"; sin él, muchos clientes ignoran las ediciones.
//   3. Los de todo el día van como VALUE=DATE, y su DTEND es **exclusivo** (el día siguiente
//      al último). Con DTEND inclusivo, un evento de un día se ve como de cero días y
//      desaparece; uno de cinco se ve de cuatro.
//   4. Plegado de líneas a 75 octetos y escapado de `, ; \ \n` en los campos de texto. Una
//      coma sin escapar en el título parte el valor en dos.
//
// **Sobre VTIMEZONE:** no se emite, y es deliberado. Los instantes van en UTC
// (`...THHMMSSZ`), que es exacto y no admite interpretación. VTIMEZONE hace falta cuando el
// cliente tiene que expandir una recurrencia en hora local cruzando cambios de horario, y la
// recurrencia está explícitamente fuera de alcance (§4 del plan). Se manda `X-WR-TIMEZONE`
// como pista de visualización. Si algún día entra RRULE, ahí sí hay que emitir el VTIMEZONE
// completo del `Tenant.timezone`.

import { localParts } from "../../common/time/zoned-time";

export type IcsItem = {
  /** Estable de por vida. Ver el punto 1 de arriba. */
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  /** Para los de todo el día, el último día **inclusive**; acá se convierte a exclusivo. */
  end: Date;
  allDay: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Deep link al módulo dueño, si lo hay. */
  url?: string | null;
};

export type IcsCalendar = {
  /** Nombre que muestran Google/Apple para el calendario suscrito. */
  name: string;
  /** IANA, solo como pista de visualización (X-WR-TIMEZONE). */
  timezone: string;
  items: IcsItem[];
};

/** Escapa un valor TEXT de RFC 5545. El orden importa: la barra invertida va primero. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Pliega una línea a 75 octetos, continuando con un espacio al principio.
 *
 * Se cuenta en **octetos UTF-8 y no en caracteres**: con acentos y eñes —o sea, en cualquier
 * título en español— un corte por longitud de string se pasa del límite, y peor, puede
 * partir un carácter multibyte a la mitad y romper el archivo.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Retrocede hasta el inicio de un carácter: 10xxxxxx es un byte de continuación.
    while (end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) end--;
    chunks.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
    limit = 74; // las líneas de continuación pierden un octeto por el espacio inicial
  }

  return chunks.join("\r\n ");
}

/** `20260729T130000Z` */
function toUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`;
}

/** `20260729`, la fecha civil del instante en la zona del colegio. */
function toDateStamp(date: Date, timezone: string): string {
  const { year, month, day } = localParts(date, timezone);
  return `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * SEQUENCE: segundos transcurridos entre la creación y la última edición.
 *
 * Empieza en 0, solo puede crecer, y se mantiene chico (un evento editado un año después da
 * ~31 millones, muy por debajo del tope de 32 bits). Usar el epoch de `updatedAt` sin restar
 * también sería creciente, pero se acerca al límite de 2^31 y desborda en 2038.
 */
function sequenceOf(item: IcsItem): number {
  return Math.max(0, Math.floor((item.updatedAt.getTime() - item.createdAt.getTime()) / 1000));
}

export function buildIcsCalendar(calendar: IcsCalendar): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Classia//Calendario Escolar//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    `X-WR-TIMEZONE:${escapeText(calendar.timezone)}`,
  ];

  for (const item of calendar.items) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${item.uid}`);
    lines.push(`DTSTAMP:${toUtcStamp(item.updatedAt)}`);
    lines.push(`SEQUENCE:${sequenceOf(item)}`);

    if (item.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${toDateStamp(item.start, calendar.timezone)}`);
      // DTEND exclusivo: el día siguiente al último día del evento.
      lines.push(`DTEND;VALUE=DATE:${toDateStamp(addDays(item.end, 1), calendar.timezone)}`);
    } else {
      lines.push(`DTSTART:${toUtcStamp(item.start)}`);
      lines.push(`DTEND:${toUtcStamp(item.end)}`);
    }

    lines.push(`SUMMARY:${escapeText(item.summary)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeText(item.description)}`);
    if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
    if (item.url) lines.push(`URL:${item.url}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF obligatorio, y el archivo termina con un salto.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
