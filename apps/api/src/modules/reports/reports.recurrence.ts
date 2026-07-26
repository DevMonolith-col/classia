// Cálculo de la próxima corrida de un reporte programado, anclado a la fecha de
// creación del schedule y a la zona horaria del colegio. Se hace con date-math
// (no con cron) porque "cada N meses" con N que no divide 12 no es expresable en
// un cron estático — su patrón no es anual. Las corridas se disparan a las 07:00
// hora local del colegio.

import { localParts, zonedWallTimeToUtc } from "../../common/time/zoned-time";

export type Recurrence = {
  frequencyType: "DAYS" | "MONTHLY";
  intervalValue: number;
  dayOfMonth: number | null;
  createdAt: Date;
};

const RUN_HOUR = 7; // 07:00 hora local del colegio
const DAY_MS = 24 * 60 * 60 * 1000;

// tzOffsetMs/zonedWallTimeToUtc/localParts viven en common/time/zoned-time.ts desde el
// 2026-07-26: el módulo de calendario necesita la misma matemática y dos copias se
// desincronizan. Comportamiento idéntico; este spec sigue siendo su cobertura.

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
