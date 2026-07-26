import { colombianHolidays, easterSunday } from "@classia/database";

// El cálculo vive en packages/database (lo necesitan el seed y la API), pero el spec vive
// acá porque packages/database no tiene runner de tests todavía y una regla sin test que
// corra es una regla que se rompe callada. Si se le agrega jest a ese paquete, este archivo
// se muda.

const iso = (h: { year: number; month: number; day: number }) =>
  `${h.year}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`;

const byName = (year: number) =>
  new Map(colombianHolidays(year).map((h) => [h.name, iso(h)]));

describe("colombianHolidays", () => {
  it("calcula la Pascua", () => {
    // Referencias conocidas del calendario gregoriano.
    expect(easterSunday(2025)).toEqual({ year: 2025, month: 4, day: 20 });
    expect(easterSunday(2026)).toEqual({ year: 2026, month: 4, day: 5 });
    expect(easterSunday(2027)).toEqual({ year: 2027, month: 3, day: 28 });
  });

  it("reproduce los 18 festivos de Colombia en 2026", () => {
    expect(colombianHolidays(2026).map(iso)).toEqual([
      "2026-01-01", // Año Nuevo (jue)
      "2026-01-12", // Reyes Magos: 6-ene mar -> lun
      "2026-03-23", // San José: 19-mar jue -> lun
      "2026-04-02", // Jueves Santo
      "2026-04-03", // Viernes Santo
      "2026-05-01", // Trabajo (vie)
      "2026-05-18", // Ascensión: Pascua+39 = 14-may jue -> lun
      "2026-06-08", // Corpus Christi: Pascua+60 = 4-jun jue -> lun
      "2026-06-15", // Sagrado Corazón: Pascua+68 = 12-jun vie -> lun
      "2026-06-29", // San Pedro y San Pablo: ya cae lunes
      "2026-07-20", // Independencia: ya cae lunes
      "2026-08-07", // Boyacá (vie)
      "2026-08-17", // Asunción: 15-ago sáb -> lun
      "2026-10-12", // Raza: ya cae lunes
      "2026-11-02", // Todos los Santos: 1-nov dom -> lun
      "2026-11-16", // Cartagena: 11-nov mié -> lun
      "2026-12-08", // Inmaculada (mar)
      "2026-12-25", // Navidad (vie)
    ]);
  });

  it("no traslada los festivos de fecha fija ni Jueves/Viernes Santo", () => {
    // 2025: el 20 de julio cayó domingo y NO se movió; el 1 de mayo cayó jueves.
    const h2025 = byName(2025);
    expect(h2025.get("Grito de Independencia")).toBe("2025-07-20");
    expect(h2025.get("Día del Trabajo")).toBe("2025-05-01");
    expect(h2025.get("Jueves Santo")).toBe("2025-04-17");
    expect(h2025.get("Viernes Santo")).toBe("2025-04-18");

    // 2027: el 1 de mayo cae sábado y sigue siendo el 1 de mayo.
    expect(byName(2027).get("Día del Trabajo")).toBe("2027-05-01");
  });

  it("marca como movido solo lo que la Ley Emiliani desplazó", () => {
    const h2026 = new Map(colombianHolidays(2026).map((h) => [h.name, h.moved]));
    expect(h2026.get("Día de los Reyes Magos")).toBe(true); // 6-ene mar -> lun 12
    expect(h2026.get("San Pedro y San Pablo")).toBe(false); // ya era lunes
    expect(h2026.get("Navidad")).toBe(false); // fijo, nunca se mueve
  });

  it("admite dos festivos el mismo día", () => {
    // 2025 es el caso real: San Pedro y San Pablo (dom 29-jun) y Sagrado Corazón
    // (vie 27-jun) se trasladaron los dos al lunes 30. Son 18 nombres, 17 fechas.
    const h2025 = byName(2025);
    expect(h2025.get("San Pedro y San Pablo")).toBe("2025-06-30");
    expect(h2025.get("Sagrado Corazón de Jesús")).toBe("2025-06-30");
    expect(colombianHolidays(2025)).toHaveLength(18);
    expect(new Set(colombianHolidays(2025).map(iso)).size).toBe(17);
  });

  it("devuelve 18 festivos ordenados, en cualquier año", () => {
    for (const year of [2024, 2025, 2026, 2027, 2030, 2040]) {
      const list = colombianHolidays(year);
      expect(list).toHaveLength(18);
      const times = list.map((h) => Date.UTC(h.year, h.month - 1, h.day));
      expect(times).toEqual([...times].sort((a, b) => a - b));
      // Todos los trasladados tienen que caer lunes.
      for (const h of list.filter((x) => x.moved)) {
        expect(new Date(Date.UTC(h.year, h.month - 1, h.day)).getUTCDay()).toBe(1);
      }
    }
  });
});
