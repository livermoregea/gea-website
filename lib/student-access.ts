export const STUDENT_EMAIL_BLOCK_REASONS = [
  { value: "not_in_gea", label: "Not in GEA" },
  { value: "inappropriate_behavior", label: "Inappropriate behavior" },
  { value: "other", label: "Other" },
] as const;

export type StudentEmailBlockReason = (typeof STUDENT_EMAIL_BLOCK_REASONS)[number]["value"];

export function getStudentEmailBlockReasonLabel(reason: string) {
  return (
    STUDENT_EMAIL_BLOCK_REASONS.find((item) => item.value === reason)?.label ??
    reason
  );
}
