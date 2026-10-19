/** CAGE's scale and calculation will be defined with the academy's formula. */
export type CageScore = {
  officer_id: string;
  academic_year: string;
  score: number | null;
  formula_version: string | null;
  calculated_at: string | null;
};

export const CAGE_NAME = 'Competency Analysis of the Green Engineering Academy';

export function currentCageScore(record: CageScore | null | undefined, officerId: string, year: string) {
  if (!record || record.officer_id !== officerId || record.academic_year !== year
    || record.score === null || !Number.isFinite(record.score) || !record.formula_version || !record.calculated_at) return null;
  return record;
}
