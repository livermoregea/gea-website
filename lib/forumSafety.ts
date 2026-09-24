const BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /https?:\/\/|www\./i,
    message: "Links are blocked here to reduce spam. Try rephrasing without a URL.",
  },
  {
    pattern: /(?:buy now|free money|make money fast|crypto pump|casino|onlyfans|porn|nude)/i,
    message: "That message looks like spam or unsafe content.",
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    message: "Email addresses are blocked in forum posts.",
  },
  {
    // Count digits, not punctuation, so school-year ranges like 2026-2027 pass.
    // Also recognize local numbers like 555-0123 without joining separate lines.
    pattern: /(?:^|[^\w])(?:\+?\d(?:[ \t().-]*\d){9,14}|\d{3}[ .-]\d{4})(?!\w)/,
    message: "Phone numbers are blocked in forum posts.",
  },
];

export function getForumSafetyMessage(text: string) {
  const value = text.trim();
  if (!value) return null;

  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(value)) {
      return rule.message;
    }
  }

  return null;
}
