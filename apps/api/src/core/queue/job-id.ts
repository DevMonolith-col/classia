// BullMQ rechaza cualquier jobId personalizado que contenga ":" — lo usa como
// separador interno de sus propias claves de Redis ("Custom Id cannot contain
// :"). Se encontró primero en access-control (AccessControlService#expiryJobId,
// que ya usaba "-" en vez de ":") y se confirmó también en
// reports.service.ts#schedulerJobId, que construía el jobId con ":" y por eso
// nunca había logrado programar un reporte recurrente con éxito — cero filas
// en report_schedules, sin rastro en Redis, siempre tiraba 500 al crear un
// schedule.
//
// Todo punto del código que arme un jobId personalizado para cualquier cola de
// BullMQ debe pasar por acá: es el único lugar que decide el separador y el
// único que falla temprano y explícito si algo prohibido se cuela, en vez de
// dejar que BullMQ lo rechace recién dentro del request con un 500 genérico.
const FORBIDDEN_CHARACTERS = /:/

export function buildJobId(...parts: (string | number)[]): string {
  const id = parts.map(String).join("-")
  if (FORBIDDEN_CHARACTERS.test(id)) {
    throw new Error(
      `jobId inválido: "${id}" contiene un carácter prohibido por BullMQ (":"). ` +
        "Ninguna de las partes que arman un jobId personalizado puede contener ':'.",
    )
  }
  return id
}
