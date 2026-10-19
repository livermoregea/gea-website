import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { generateObject, wrapLanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { geaiRecommendation, geaiSchema, geaiPrompt, type GeaiSource } from '@/lib/geai';
import { cacheGeaiBrief, geaiFailureCode } from '@/lib/geai-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'no-store' };
type Job = { user_id: string; fingerprint: string; lease_token: string;
  snapshot: { today: string; reviewer: boolean; sources: GeaiSource[]; workspaceHref: string } };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from(secret ? `Bearer ${secret}` : '');
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected))
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401, headers });
  if (!process.env.GROQ_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return NextResponse.json({ error: 'GEAI background generation is not configured.' }, { status: 503, headers });
  const admin = createAdminClient();
  const modelId = process.env.GROQ_GEAI_MODEL || 'openai/gpt-oss-20b';
  const jobs: Job[] = [];
  // At most six per invocation. SQL atomically enforces a global 24/day budget,
  // a six-hour normal interval with one bounded retry, and concurrent leases.
  for (let i = 0; i < 6; i++) {
    const { data, error } = await admin.rpc('claim_gea_geai_brief');
    if (error) return NextResponse.json({ error: 'GEAI cache needs database setup.' }, { status: 503, headers });
    if (!data) break;
    jobs.push(data as Job);
  }
  const results = await Promise.all(jobs.map(async job => {
    let brief = null;
    let failureCode: string | null = null;
    const signal = AbortSignal.timeout(40000);
    try {
      const selected = job.snapshot.sources.slice(0, 3);
      const provider = createOpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY });
      const model = wrapLanguageModel({ model: provider.chat(modelId), middleware: {
        specificationVersion: 'v3', transformParams: async ({ params }) => ({ ...params,
          responseFormat: params.responseFormat?.type === 'json' ? { type: 'json' } : params.responseFormat,
        }),
      } });
      const { object } = await generateObject({ model, schema: geaiSchema, temperature: 0,
        ...(modelId.startsWith('openai/gpt-oss-') ? { providerOptions: { openai: { reasoningEffort: 'low' } } } : {}),
        system: `${geaiPrompt}\nJSON schema: ${JSON.stringify(z.toJSONSchema(geaiSchema))}`,
        prompt: JSON.stringify({ today: job.snapshot.today, reviewer: job.snapshot.reviewer,
          sources: selected.map(({ href: _href, ...source }) => source) }),
        maxOutputTokens: 900, maxRetries: 0, abortSignal: signal });
      brief = cacheGeaiBrief(geaiRecommendation(geaiSchema.parse(object), selected, job.snapshot.workspaceHref), job.snapshot);
    } catch (error) {
      failureCode = signal.aborted ? 'timeout' : geaiFailureCode(error);
      console.warn('[GEAI] Generation failed', { code: failureCode });
    }
    if (failureCode) {
      const { error } = await admin.rpc('fail_gea_geai_brief', {
        p_user_id: job.user_id, p_lease_token: job.lease_token, p_error_code: failureCode,
      });
      if (!error) return false;
      // Older installations still release the lease until the recovery SQL runs.
    }
    const { data: saved, error } = await admin.rpc('finish_gea_geai_brief', {
      p_user_id: job.user_id, p_lease_token: job.lease_token,
      p_fingerprint: job.fingerprint, p_brief: brief,
    });
    return Boolean(brief && saved && !error);
  }));
  return NextResponse.json({ attempted: jobs.length, updated: results.filter(Boolean).length }, { headers });
}
