const BLOCKED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /https?:\/\/\S+/i,
    message: "Links are blocked here to reduce spam. Try rephrasing without a URL.",
  },
  {
    pattern: /\b(?:buy now|free money|make money fast|crypto pump|casino|onlyfans|porn|nude)\b/i,
    message: "That message looks like spam or unsafe content.",
  },
  {
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    message: "Email addresses are blocked in forum posts.",
  },
  {
    pattern: /\+?\d[\d\s().-]{7,}\d/,
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
