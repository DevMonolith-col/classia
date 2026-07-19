import { buildJobId } from "./job-id"

describe("buildJobId", () => {
  it("junta las partes con '-'", () => {
    expect(buildJobId("access-session-expire", "abc-123")).toBe("access-session-expire-abc-123")
  })

  it("acepta números (timestamps) como parte", () => {
    expect(buildJobId("schedule", "sched-1", 1784445906440)).toBe("schedule-sched-1-1784445906440")
  })

  it("acepta una sola parte", () => {
    expect(buildJobId("access-session-expiry-sweep")).toBe("access-session-expiry-sweep")
  })

  it("falla explícito si alguna parte trae ':' — el bug real que motivó este helper", () => {
    expect(() => buildJobId("schedule", "abc", "12:30")).toThrow(/carácter prohibido/)
  })

  it("falla explícito si el ':' viene del propio id (UUID, timestamp formateado, etc.)", () => {
    expect(() => buildJobId("access-session-expire", "2026-07-19T07:25:06.440Z")).toThrow(/carácter prohibido/)
  })

  it("el patrón que reports.service.ts#schedulerJobId usaba antes del fix (con ':') debe fallar", () => {
    // Reproduce literalmente el jobId viejo que BullMQ rechazaba en runtime
    // ("Custom Id cannot contain :") para que este test se rompa si alguien
    // reintroduce el separador ':' en cualquier construcción de jobId.
    const scheduleId = "11111111-1111-1111-1111-111111111111"
    const runAtMs = 1784445906440
    const oldStyleId = `schedule:${scheduleId}:${runAtMs}`
    expect(oldStyleId).toContain(":")
    expect(() => buildJobId(oldStyleId)).toThrow(/carácter prohibido/)
  })
})
