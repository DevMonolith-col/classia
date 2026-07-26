import { buildIcsCalendar, type IcsItem } from "./ics";

const BOGOTA = "America/Bogota";

function item(overrides: Partial<IcsItem> = {}): IcsItem {
  return {
    uid: "evento-1@demo.classia",
    summary: "Consejo directivo",
    start: new Date("2026-07-29T13:00:00.000Z"),
    end: new Date("2026-07-29T14:00:00.000Z"),
    allDay: false,
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
    ...overrides,
  };
}

function build(items: IcsItem[]) {
  return buildIcsCalendar({ name: "Colegio Demo", timezone: BOGOTA, items });
}

/** Deshace el plegado de líneas para poder afirmar sobre el valor completo. */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n").filter(Boolean);
}

describe("buildIcsCalendar", () => {
  it("emite un VCALENDAR válido con CRLF", () => {
    const ics = build([item()]);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Ningún \n suelto: RFC 5545 exige CRLF en todos lados.
    expect(/[^\r]\n/.test(ics)).toBe(false);
    expect(unfold(ics)).toEqual(
      expect.arrayContaining(["VERSION:2.0", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]),
    );
  });

  it("emite los instantes en UTC", () => {
    const lines = unfold(build([item()]));
    expect(lines).toEqual(
      expect.arrayContaining(["DTSTART:20260729T130000Z", "DTEND:20260729T140000Z"]),
    );
  });

  // El DTEND de un VALUE=DATE es EXCLUSIVO. Con el fin inclusivo, un evento de un día se ve
  // de cero días y los clientes directamente no lo muestran.
  it("usa VALUE=DATE con DTEND exclusivo para los de todo el día", () => {
    const lines = unfold(
      build([
        item({
          allDay: true,
          // 15 de mayo completo en Bogotá: 05:00Z del 15 a 04:59:59.999Z del 16.
          start: new Date("2026-05-15T05:00:00.000Z"),
          end: new Date("2026-05-16T04:59:59.999Z"),
        }),
      ]),
    );
    expect(lines).toEqual(
      expect.arrayContaining(["DTSTART;VALUE=DATE:20260515", "DTEND;VALUE=DATE:20260516"]),
    );
  });

  it("conserva un rango de varios días con el fin exclusivo", () => {
    const lines = unfold(
      build([
        item({
          allDay: true,
          start: new Date("2026-06-22T05:00:00.000Z"),
          end: new Date("2026-06-27T04:59:59.999Z"), // último día: 26 de junio
        }),
      ]),
    );
    expect(lines).toContain("DTSTART;VALUE=DATE:20260622")
    expect(lines).toContain("DTEND;VALUE=DATE:20260627") // 26 + 1
  });

  // La fecha civil se toma en la zona del colegio. Un evento que arranca a las 05:00Z es el
  // día 15 en Bogotá; leído en UTC daría el mismo día acá, pero un tenant al este de
  // Greenwich lo vería corrido.
  it("calcula la fecha de los VALUE=DATE en la zona del colegio", () => {
    const ics = buildIcsCalendar({
      name: "Colegio",
      timezone: "Pacific/Auckland", // UTC+12
      items: [
        item({
          allDay: true,
          start: new Date("2026-05-14T12:00:00.000Z"), // 15 de mayo 00:00 en Auckland
          end: new Date("2026-05-14T12:00:00.000Z"),
        }),
      ],
    });
    expect(unfold(ics)).toContain("DTSTART;VALUE=DATE:20260515");
  });

  it("el UID no cambia al editar y el SEQUENCE sube", () => {
    const creado = item();
    const editado = item({ updatedAt: new Date("2026-07-05T10:00:00.000Z") });

    const lineasCreado = unfold(build([creado]));
    const lineasEditado = unfold(build([editado]));

    expect(lineasCreado).toContain("UID:evento-1@demo.classia");
    expect(lineasEditado).toContain("UID:evento-1@demo.classia");
    expect(lineasCreado).toContain("SEQUENCE:0");
    // 4 días = 345600 s
    expect(lineasEditado).toContain("SEQUENCE:345600");
    // Y el DTSTAMP refleja la edición, no la creación.
    expect(lineasEditado).toContain("DTSTAMP:20260705T100000Z");
  });

  it("escapa comas, punto y coma, barras y saltos de línea", () => {
    const lines = unfold(
      build([
        item({
          summary: "Reunión: 5A, 5B; sin falta",
          description: "Primera línea\nSegunda línea con \\ barra",
          location: "Aula 1, piso 2",
        }),
      ]),
    );
    expect(lines).toContain("SUMMARY:Reunión: 5A\\, 5B\\; sin falta");
    expect(lines).toContain("DESCRIPTION:Primera línea\\nSegunda línea con \\\\ barra");
    expect(lines).toContain("LOCATION:Aula 1\\, piso 2");
  });

  it("pliega las líneas largas sin partir un carácter multibyte", () => {
    // Solo eñes: 100 caracteres, 200 octetos en UTF-8. Si el plegado contara caracteres en
    // vez de octetos, las líneas se pasarían del límite; si cortara sin mirar, partiría una
    // eñe a la mitad y el texto quedaría corrupto.
    const summary = "ñ".repeat(100);
    const ics = build([item({ summary })]);

    for (const line of ics.split("\r\n")) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(75);
    }
    // Y al deshacer el plegado, el título vuelve intacto.
    expect(unfold(ics)).toContain(`SUMMARY:${summary}`);
  });

  it("omite los campos opcionales que no vienen", () => {
    const lines = unfold(build([item({ description: null, location: null, url: null })]));
    expect(lines.some((l) => l.startsWith("DESCRIPTION:"))).toBe(false);
    expect(lines.some((l) => l.startsWith("LOCATION:"))).toBe(false);
    expect(lines.some((l) => l.startsWith("URL:"))).toBe(false);
  });

  it("emite un calendario vacío bien formado", () => {
    const ics = build([]);
    expect(unfold(ics).filter((l) => l === "BEGIN:VEVENT")).toHaveLength(0);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("abre y cierra un VEVENT por ítem", () => {
    const lines = unfold(build([item(), item({ uid: "evento-2@demo.classia" })]));
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(2);
  });
});
