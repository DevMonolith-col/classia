// Festivos nacionales de Colombia, calculados y no tabulados.
//
// Se calculan porque una tabla estática por año hay que mantenerla cada diciembre y el año
// que nadie actualice, el calendario del colegio queda sin festivos en silencio. Las tres
// reglas que hacen falta son cerradas y no cambian:
//
//   1. Fijos: caen en su fecha, pase lo que pase.
//   2. Ley 51 de 1983 ("Ley Emiliani"): se trasladan al lunes siguiente si no caen lunes.
//   3. Móviles de Semana Santa: se derivan de la Pascua. Jueves y Viernes Santo NO se
//      trasladan; Ascensión, Corpus Christi y Sagrado Corazón sí.
//
// Las fechas se devuelven como fecha civil (año, mes, día) sin hora: convertirlas a un
// instante depende de la zona del colegio y eso lo decide quien las consuma.

export type CivilDate = { year: number; month: number; day: number };

export type ColombianHoliday = CivilDate & {
  name: string;
  /** true si la Ley Emiliani lo movió de su fecha original. */
  moved: boolean;
};

/** Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher (calendario gregoriano). */
export function easterSunday(year: number): CivilDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { year, month, day };
}

// Se opera en UTC a propósito: son fechas civiles, no instantes, y usar la zona local del
// proceso haría que el mismo año diera festivos distintos según dónde corra el servidor.
function toUtc({ year, month, day }: CivilDate): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function addDays(date: CivilDate, days: number): CivilDate {
  const shifted = toUtc(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return fromUtc(shifted);
}

/** Lunes siguiente, o la misma fecha si ya es lunes (Ley 51 de 1983). */
function nextMonday(date: CivilDate): { date: CivilDate; moved: boolean } {
  const dayOfWeek = toUtc(date).getUTCDay(); // 0 = domingo, 1 = lunes
  if (dayOfWeek === 1) return { date, moved: false };
  const delta = (8 - dayOfWeek) % 7;
  return { date: addDays(date, delta), moved: true };
}

/**
 * Los 18 festivos nacionales del año. No incluye días no lectivos propios del colegio
 * (semanas de desarrollo institucional, calendario A/B): esos los captura cada colegio,
 * porque es donde de verdad varían.
 *
 * **Dos festivos pueden caer el mismo día.** Son 18 nombres, no 18 fechas distintas: en
 * 2025, San Pedro y San Pablo (dom 29-jun) y Sagrado Corazón (vie 27-jun) se trasladaron
 * ambos al lunes 30 de junio. Quien consuma esto no puede usar la fecha como clave única.
 */
export function colombianHolidays(year: number): ColombianHoliday[] {
  const easter = easterSunday(year);

  const fixed: Array<{ name: string; month: number; day: number }> = [
    { name: "Año Nuevo", month: 1, day: 1 },
    { name: "Día del Trabajo", month: 5, day: 1 },
    { name: "Grito de Independencia", month: 7, day: 20 },
    { name: "Batalla de Boyacá", month: 8, day: 7 },
    { name: "Inmaculada Concepción", month: 12, day: 8 },
    { name: "Navidad", month: 12, day: 25 },
  ];

  // Trasladables por Ley Emiliani.
  const emiliani: Array<{ name: string; month: number; day: number }> = [
    { name: "Día de los Reyes Magos", month: 1, day: 6 },
    { name: "Día de San José", month: 3, day: 19 },
    { name: "San Pedro y San Pablo", month: 6, day: 29 },
    { name: "Asunción de la Virgen", month: 8, day: 15 },
    { name: "Día de la Raza", month: 10, day: 12 },
    { name: "Día de Todos los Santos", month: 11, day: 1 },
    { name: "Independencia de Cartagena", month: 11, day: 11 },
  ];

  // Móviles. Los offsets son desde el Domingo de Pascua.
  const easterFixed: Array<{ name: string; offset: number }> = [
    { name: "Jueves Santo", offset: -3 },
    { name: "Viernes Santo", offset: -2 },
  ];
  const easterEmiliani: Array<{ name: string; offset: number }> = [
    { name: "Ascensión del Señor", offset: 39 },
    { name: "Corpus Christi", offset: 60 },
    { name: "Sagrado Corazón de Jesús", offset: 68 },
  ];

  const holidays: ColombianHoliday[] = [
    ...fixed.map((h) => ({ name: h.name, year, month: h.month, day: h.day, moved: false })),
    ...emiliani.map((h) => {
      const { date, moved } = nextMonday({ year, month: h.month, day: h.day });
      return { name: h.name, ...date, moved };
    }),
    ...easterFixed.map((h) => ({ name: h.name, ...addDays(easter, h.offset), moved: false })),
    ...easterEmiliani.map((h) => {
      const { date, moved } = nextMonday(addDays(easter, h.offset));
      return { name: h.name, ...date, moved };
    }),
  ];

  return holidays.sort(
    (a, b) => toUtc(a).getTime() - toUtc(b).getTime(),
  );
}

/** La fecha del festivo como instante UTC de medianoche civil. */
export function holidayToUtcDate(holiday: CivilDate): Date {
  return toUtc(holiday);
}
