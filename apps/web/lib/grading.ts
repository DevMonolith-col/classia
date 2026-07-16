// Fuente única de la definitiva en el frontend. Antes había dos fórmulas
// divergentes (profesor/calificaciones y student-grades-table). Esta superficie
// de edición en vivo calcula el promedio ponderado normalizado; el boletín
// oficial e inmutable lo calcula el backend (report-cards). Ambos comparten el
// mismo criterio: promedio de (value/maxValue) ponderado por peso.

export type GradeEntry = { value: number; maxValue: number; weight: number };

export type WeightedFinal = {
  fraction: number | null; // 0..1, null si no hay notas
  percent: number | null; // fraction × 100, para la superficie de edición (celdas 0..100)
  gradedCount: number;
  gradedWeight: number;
};

export function computeWeightedFinal(entries: GradeEntry[]): WeightedFinal {
  let weightedFraction = 0;
  let gradedWeight = 0;
  let gradedCount = 0;

  for (const entry of entries) {
    if (!entry.maxValue) continue;
    const weight = entry.weight > 0 ? entry.weight : 1; // sin peso => peso equitativo
    weightedFraction += (entry.value / entry.maxValue) * weight;
    gradedWeight += weight;
    gradedCount += 1;
  }

  const fraction = gradedWeight > 0 ? weightedFraction / gradedWeight : null;
  return {
    fraction,
    percent: fraction === null ? null : Math.round(fraction * 100 * 10) / 10,
    gradedCount,
    gradedWeight,
  };
}
