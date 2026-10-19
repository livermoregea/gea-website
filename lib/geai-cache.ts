import { createHash } from 'node:crypto';
import { geaiSnapshot, type GeaiBrief, type GeaiSource } from './geai';

export type GeaiSnapshot = { today: string; reviewer: boolean; workspaceHref: string; sources: GeaiSource[] };
export type GeaiCacheCandidate = { kind: 'geai-cache-candidate'; brief: GeaiBrief | null; lastErrorCode?: string | null };
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const scopeKey = (snapshot: GeaiSnapshot) => digest({ version: 2, reviewer: snapshot.reviewer, workspaceHref: snapshot.workspaceHref });
function sourceKey(source: GeaiSource) {
  // IDs are list positions, so they must not invalidate an unchanged item when
  // its neighbors move. Every fact supplied to the model still has to match.
  const { id: _position, ...facts } = source;
  return digest({ title: facts.title, detail: facts.detail, href: facts.href, nextStep: facts.nextStep,
    date: facts.date, taskInstructions: facts.taskInstructions, eventDescription: facts.eventDescription });
}

export function cacheGeaiBrief(brief: GeaiBrief, snapshot: GeaiSnapshot): GeaiBrief {
  return { ...brief, cacheScope: scopeKey(snapshot), priorities: brief.priorities.map((item, i) => ({
    ...item, cacheKey: sourceKey(snapshot.sources[i]),
  })) };
}

export function reuseGeaiDescriptions(snapshot: GeaiSnapshot, candidate: GeaiCacheCandidate): GeaiBrief {
  const result = geaiSnapshot(snapshot.sources, snapshot.workspaceHref);
  result.aiStatus = candidate.lastErrorCode ? 'retry_pending' : 'pending';
  const cached = candidate.brief;
  // Legacy briefs without evidence digests cannot safely be partially reused.
  if (!cached || cached.cacheScope !== scopeKey(snapshot) || !Array.isArray(cached.priorities)
    || !Number.isFinite(Date.parse(cached.generatedAt)) || Date.now() - Date.parse(cached.generatedAt) >= 86400000) return result;
  let reused = 0;
  result.priorities = result.priorities.map((item, i) => {
    const key = sourceKey(snapshot.sources[i]);
    const saved = cached.priorities.find(old => old.cacheKey === key && old.href === item.href
      && old.descriptionSource === 'ai' && typeof old.description === 'string' && old.description.length > 0);
    if (!saved) return item;
    reused++;
    return { ...item, description: saved.description, descriptionSource: 'ai' };
  });
  if (reused) {
    result.mode = reused === result.priorities.length ? 'ai' : 'mixed';
    result.generatedAt = cached.generatedAt;
  }
  return result;
}

/** Store only an allowlisted failure category, never provider bodies or prompts. */
export function geaiFailureCode(error: unknown): string {
  let current = error;
  let invalidResponse = false;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const value = current as { name?: string; statusCode?: number; cause?: unknown; message?: string };
    if (value.statusCode === 429) return 'rate_limited';
    if (value.statusCode === 404) return 'model_unavailable';
    if (value.statusCode === 401 || value.statusCode === 403) return 'provider_auth';
    if (value.statusCode && value.statusCode >= 500) return 'provider_unavailable';
    if (/Timeout|Abort/.test(value.name || '')) return 'timeout';
    if (/Zod|NoObjectGenerated|TypeValidation/.test(value.name || '') || /^GEAI (returned|omitted)/.test(value.message || '')) {
      invalidResponse = true;
      if (value.cause) { current = value.cause; continue; }
      return 'invalid_response';
    }
    current = value.cause;
  }
  return invalidResponse ? 'invalid_response' : 'generation_failed';
}
