// Cálculo de la próxima corrida de un reporte programado, anclado a la fecha de
// creación del schedule y a la zona horaria del colegio. Se hace con date-math
// (no con cron) porque "cada N meses" con N que no divide 12 no es expresable en
// un cron estático — su patrón no es anual. Las corridas se disparan a las 07:00
// hora local del colegio.

export type Recurrence = {
  frequencyType: "DAYS" | "MONTHLY";
  intervalValue: number;
  dayOfMonth: number | null;
  createdAt: Date;
};

const RUN_HOUR = 7; // 07:00 hora local del colegio
const DAY_MS = 24 * 60 * 60 * 1000;

// Offset (ms) de una zona IANA en un instante dado: (hora de pared interpretada
// como si fuera UTC) − instante real. Para zonas sin DST (p. ej. Colombia) es
// exacto; para zonas con DST usa el offset vigente en ese instante.
function tzOffsetMs(instant: Date, tz: string): number {
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
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +hour, +map.minute, +map.second);
  return asUtc - instant.getTime();
}

// Instante UTC correspondiente a una hora de pared (y, m, d, hora) en la zona tz.
// Date.UTC normaliza meses/días desbordados (p. ej. día 33 → mes siguiente).
function zonedWallTimeToUtc(year: number, month1to12: number, day: number, hour: number, tz: string): Date {
  const naiveUtc = Date.UTC(year, month1to12 - 1, day, hour, 0, 0);
  const offset = tzOffsetMs(new Date(naiveUtc), tz);
  return new Date(naiveUtc - offset);
}

function localParts(instant: Date, tz: string): { year: number; month: number; day: number } {
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
 * Próxima corrida (instante UTC) estrictamente posterior a `after`, según la
 * recurrencia y la zona horaria del colegio. La rejilla de ocurrencias es
 * determinista dada `createdAt` (el ancla), así que reprogramar tras una corrida
 * con `after = ocurrencia actual` es idempotente ante reintentos.
 */
export function computeNextRun(recurrence: Recurrence, tz: string, after: Date): Date {
  const anchor = localParts(recurrence.createdAt, tz);
  const N = recurrence.intervalValue;

  if (recurrence.frequencyType === "MONTHLY") {
    const day = recurrence.dayOfMonth ?? 1;
    // Ocurrencias: mes del ancla + k·N, en el día elegido, cada N meses.
    for (let k = 0; k < 2400; k++) {
      const monthsFromAnchor = anchor.month - 1 + k * N;
      const year = anchor.year + Math.floor(monthsFromAnchor / 12);
      const month = (monthsFromAnchor % 12) + 1;
      const candidate = zonedWallTimeToUtc(year, month, day, RUN_HOUR, tz);
      if (candidate.getTime() > after.getTime()) return candidate;
    }
    throw new Error("No se pudo calcular la próxima corrida mensual");
  }

  // DAYS: cada N días a las 07:00 locales, anclado a la fecha de creación.
  const base = zonedWallTimeToUtc(anchor.year, anchor.month, anchor.day, RUN_HOUR, tz).getTime();
  // Salto directo al primer k candidato (evita iterar día por día), luego se
  // ajusta recomputando la hora de pared exacta por si hubo cambio de offset.
  let k = Math.max(0, Math.ceil((after.getTime() - base) / (N * DAY_MS)));
  for (let guard = 0; guard < 800; guard++) {
    const candidate = zonedWallTimeToUtc(anchor.year, anchor.month, anchor.day + k * N, RUN_HOUR, tz);
    if (candidate.getTime() > after.getTime()) return candidate;
    k++;
  }
  throw new Error("No se pudo calcular la próxima corrida diaria");
}
