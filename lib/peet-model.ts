/** Shared by website and Discord task reviews. Explicit settings stay explicit. */
export function peetModelId() {
  return process.env.GROQ_PEET_MODEL?.trim() || 'openai/gpt-oss-120b';
}
