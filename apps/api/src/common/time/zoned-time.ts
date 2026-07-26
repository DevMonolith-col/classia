// Aritmética de horas de pared en una zona IANA, sin dependencias externas.
//
// Se extrajo de modules/reports/reports.recurrence.ts el 2026-07-26, cuando el módulo de
// calendario necesitó exactamente la misma matemática para normalizar los eventos de todo
// el día a los límites del día en Tenant.timezone. El comportamiento es idéntico al
// original — reports.recurrence.spec.ts lo cubre — y vive acá para que no haya dos copias
// que se desincronicen.

/**
 * Offset (ms) de una zona IANA en un instante dado: (hora de pared interpretada como si
 * fuera UTC) − instante real. Para zonas sin DST (p. ej. Colombia, UTC-5 todo el año) es
 * exacto; para zonas con DST usa el offset vigente en ese instante.
 */
export function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  const hour = map.hour === "24" ? "00" : map.hour; // Intl puede devolver "24" a medianoche
  // Los milisegundos se copian del instante en vez de dejarlos en 0: Intl formatea con
  // precisión de segundo, y sin esto el offset se lleva los ms como si fueran parte del
  // desfase de la zona. Ningún offset IANA tiene componente sub-segundo, así que la hora de
  // pared comparte los ms con el instante por definición.
  //
  // Se descubrió el 2026-07-26: el fin de un día "todo el día" salía 23:59:59.999 local ->
  // 05:00:00.998Z en vez de 04:59:59.999Z, o sea el día siguiente por 1 ms. En el único
  // llamador que había (reports.recurrence, que siempre pasa 00:00:00.000) el bug era
  // invisible.
  const asUtc = Date.UTC(
    +map.year,
    +map.month - 1,
    +map.day,
    +hour,
    +map.minute,
    +map.second,
    instant.getUTCMilliseconds(),
  );
  return asUtc - instant.getTime();
}

/**
 * Instante UTC correspondiente a una hora de pared (y, m, d, hora) en la zona tz.
 * Date.UTC normaliza meses/días desbordados (p. ej. día 33 → mes siguiente).
 */
export function zonedWallTimeToUtc(
  year: number,
  month1to12: number,
  day: number,
  hour: number,
  tz: string,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const naiveUtc = Date.UTC(year, month1to12 - 1, day, hour, minute, second, ms);
  const offset = tzOffsetMs(new Date(naiveUtc), tz);
  return new Date(naiveUtc - offset);
}

/** Año, mes y día de pared de un instante en la zona tz. */
export function localParts(instant: Date, tz: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) map[p.type] = p.value;
  return { year: +map.year, month: +map.month, day: +map.day };
}

/**
 * Límites (00:00:00.000 y 23:59:59.999 de pared, en la zona tz) del día civil que `instant`
 * representa. La fecha civil se lee de las **partes UTC** del instante, no de su hora de
 * pared en tz, y esa elección es la parte importante:
 *
 * Un evento de todo el día no tiene hora, tiene fecha. En el cable, una fecha se serializa
 * como medianoche UTC — `new Date("2026-05-15")` y un `<input type="date">` dan
 * `2026-05-15T00:00:00Z`. Si se interpretara ese instante en hora de Bogotá (UTC-5) daría
 * el 14 de mayo a las 19:00, y el evento quedaría guardado un día antes: exactamente el bug
 * que la bandera `allDay` existe para prevenir. Leyendo la fecha civil de las partes UTC,
 * "2026-05-15" significa el 15 de mayo en el colegio.
 *
 * Las dos convenciones coinciden para cualquier instante desde las 05:00Z en adelante (en
 * Bogotá), así que mandar la medianoche local correcta también funciona.
 */
export function zonedDayBounds(instant: Date, tz: string): { start: Date; end: Date } {
  const year = instant.getUTCFullYear();
  const month = instant.getUTCMonth() + 1;
  const day = instant.getUTCDate();
  return {
    start: zonedWallTimeToUtc(year, month, day, 0, tz),
    end: zonedWallTimeToUtc(year, month, day, 23, tz, 59, 59, 999),
  };
}
