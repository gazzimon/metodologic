export type Cycle = {
  id: string;
  startTime: number;
  endTime: number;
  duration?: number;
  confidence?: number;
  bodyKeypoints?: any[];
  handKeypoints?: any[];
};

export function enforceContinuity(
  rawCycles: Cycle[],
  opts?: { sessionStart?: number; clampNonPositive?: boolean }
): Cycle[] {
  if (!rawCycles?.length) return [];

  const cycles = [...rawCycles].sort((a, b) => a.startTime - b.startTime);

  // Si quieres forzar el start del primer ciclo (p. ej. al 0 del video)
  if (opts?.sessionStart !== undefined) {
    cycles[0].startTime = opts.sessionStart;
  }

  for (let i = 1; i < cycles.length; i++) {
    // pegar el inicio del ciclo i con el fin del ciclo i-1
    cycles[i].startTime = cycles[i - 1].endTime;
  }

  for (const c of cycles) {
    c.duration = c.endTime - c.startTime;
    if (opts?.clampNonPositive && (!isFinite(c.duration) || c.duration <= 0)) {
      c.endTime = c.startTime + 1e-3;
      c.duration = 1e-3;
    }
  }

  return cycles;
}
