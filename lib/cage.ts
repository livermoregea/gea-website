export const CAGE_NAME = 'Competency Analysis of the Green Engineering Academy';
export const CAGE_MAX_SCORE = 50 + 0.4 * 100;

/** Apply the academy's formula exactly, without capping strikes or the result. */
export function calculateCageScore(peetScore: number | null, attendanceStrikes: number, conductStrikes: number): number | null {
  if (peetScore === null || !Number.isFinite(peetScore) || peetScore < 0 || peetScore > 100
    || !Number.isSafeInteger(attendanceStrikes) || attendanceStrikes < 0
    || !Number.isSafeInteger(conductStrikes) || conductStrikes < 0) return null;
  return 50 + 0.4 * peetScore - 10 * attendanceStrikes - 10 * conductStrikes;
}
