/** Return allowlisted categories only, never provider responses or submission text. */
export function discordFailureCode(error: unknown): string {
  let current = error;
  let invalid = false;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const e = current as { name?: string; statusCode?: number; cause?: unknown; code?: string; finishReason?: string; url?: string };
    if (e.statusCode === 429) return 'ai_rate_limited';
    if (e.statusCode === 401 || e.statusCode === 403) return 'service_auth';
    if (e.statusCode === 404) {
      let groq = false;
      try { groq = new URL(e.url || '').hostname === 'api.groq.com'; } catch { /* Unknown origin is not proof of a model failure. */ }
      return groq ? 'ai_model_unavailable' : 'service_not_found';
    }
    if (e.statusCode && e.statusCode >= 500) return 'service_unavailable';
    if (['42883', '42703', '42P01', '42P10', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e.code || '')) return 'database_setup';
    if (e.code === 'P0001') return 'record_changed';
    if (/Timeout|Abort/.test(e.name || '')) return 'timeout';
    if (e.finishReason === 'length') return 'ai_response_incomplete';
    if (/NoObjectGenerated|TypeValidation|Zod/.test(e.name || '')) invalid = true;
    current = e.cause;
  }
  return invalid ? 'ai_response_invalid' : 'processing_failed';
}
export function discordFailureMessage(code: string) {
  switch (code) {
    case 'ai_rate_limited': return 'The AI service is rate-limited. Wait a few minutes, then resume your submission.';
    case 'service_auth': return 'A server credential was rejected. Ask an advisor to check the AI/service configuration.';
    case 'ai_model_unavailable': return 'Groq could not find or allow the configured AI model. Ask an advisor to set GROQ_PEET_MODEL to openai/gpt-oss-120b in Production and redeploy, then resume your saved submission.';
    case 'service_not_found': return 'A required service endpoint was not found. Ask an advisor to check the server configuration. Your saved submission can be resumed.';
    case 'database_setup': return 'The task workflow needs a database setup update. Ask an advisor to apply the latest officer and Discord migrations.';
    case 'record_changed': return 'This task changed while it was processing. Reopen it and check its current status.';
    case 'timeout': return 'Processing timed out. Resume your submission to continue from the saved work.';
    case 'ai_response_invalid': case 'ai_response_incomplete': return 'The AI response could not be validated. Resume your submission to try again.';
    default: return 'Processing could not finish. Resume your submission or reopen the command to try again.';
  }
}
