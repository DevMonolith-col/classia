import { computeNextRun, Recurrence } from "./reports.recurrence";

// America/Bogota es UTC-5 sin horario de verano, así que 07:00 local = 12:00 UTC.
const TZ = "America/Bogota";

describe("computeNextRun", () => {
  it("MONTHLY con intervalo que NO divide 12 (cada 5 meses) salta al mes correcto", () => {
    const rec: Recurrence = {
      frequencyType: "MONTHLY",
      intervalValue: 5,
      dayOfMonth: 15,
      createdAt: new Date("2026-02-10T00:00:00.000Z"), // ancla: febrero
    };
    // Ocurrencias: Feb, Jul, Dic, ... Tras la de febrero, la siguiente es julio.
    const next = computeNextRun(rec, TZ, new Date("2026-03-01T00:00:00.000Z"));
    expect(next.toISOString()).toBe("2026-07-15T12:00:00.000Z");
  });

  it("MONTHLY cada 5 meses cruza el año correctamente", () => {
    const rec: Recurrence = {
      frequencyType: "MONTHLY",
      intervalValue: 5,
      dayOfMonth: 15,
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
    };
    // Después de diciembre 2026 (2+10) la siguiente es mayo 2027 (2+15 meses).
    const next = computeNextRun(rec, TZ, new Date("2026-12-20T00:00:00.000Z"));
    expect(next.toISOString()).toBe("2027-05-15T12:00:00.000Z");
  });

  it("MONTHLY mensual (cada 1) va al primero del mes siguiente a las 07:00 locales", () => {
    const rec: Recurrence = {
      frequencyType: "MONTHLY",
      intervalValue: 1,
      dayOfMonth: 1,
      createdAt: new Date("2026-01-15T00:00:00.000Z"),
    };
    const next = computeNextRun(rec, TZ, new Date("2026-01-20T00:00:00.000Z"));
    expect(next.toISOString()).toBe("2026-02-01T12:00:00.000Z");
    expect(next.getUTCHours()).toBe(12); // 07:00 Bogota
  });

  it("DAYS cada 7 días parte del ancla a las 07:00 locales", () => {
    const rec: Recurrence = {
      frequencyType: "DAYS",
      intervalValue: 7,
      dayOfMonth: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"), // 05:00 Bogota, día 1
    };
    // Base = 2026-01-01 07:00 Bogota = 12:00 UTC. Tras esa, la siguiente es +7 días.
    const next = computeNextRun(rec, TZ, new Date("2026-01-01T12:00:00.000Z"));
    expect(next.toISOString()).toBe("2026-01-08T12:00:00.000Z");
  });

  it("DAYS salta directo al primer candidato futuro sin iterar día por día", () => {
    const rec: Recurrence = {
      frequencyType: "DAYS",
      intervalValue: 7,
      dayOfMonth: null,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    };
    const next = computeNextRun(rec, TZ, new Date("2026-01-05T00:00:00.000Z"));
    expect(next.toISOString()).toBe("2026-01-08T12:00:00.000Z");
  });

  it("devuelve una ocurrencia estrictamente posterior a `after`", () => {
    const rec: Recurrence = {
      frequencyType: "MONTHLY",
      intervalValue: 3,
      dayOfMonth: 10,
      createdAt: new Date("2026-01-05T00:00:00.000Z"),
    };
    const occurrence = new Date("2026-01-10T12:00:00.000Z"); // enero 10 07:00 Bogota
    const next = computeNextRun(rec, TZ, occurrence);
    expect(next.getTime()).toBeGreaterThan(occurrence.getTime());
    expect(next.toISOString()).toBe("2026-04-10T12:00:00.000Z");
  });
});
