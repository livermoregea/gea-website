'use client';
import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import GeaiBrand from '@/components/GeaiBrand';
import type { OperationsData } from '@/lib/gea-operations-data';
import { geaiSources, geaiSnapshot, type GeaiBrief } from '@/lib/geai';
import { schoolToday } from '@/lib/officer-tracking';
import s from './operations.module.css';

export default function GeaiBriefing({ data }: { data?: OperationsData }) {
  const headingId = useId();
  const sources = data ? geaiSources(data, schoolToday()) : [];
  const revision = JSON.stringify([data?.userId, data?.reviewer, data?.workspaceHref, sources]);
  const [result, setResult] = useState<{ revision: string; brief: GeaiBrief } | null>(null);
  const [requestId, setRequestId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const brief = result?.revision === revision ? result.brief : data ? geaiSnapshot(sources, data.workspaceHref) : null;
  const hasSavedDescriptions = brief?.priorities.some(item => item.descriptionSource === 'saved');
  const fallbackLabel = hasSavedDescriptions ? 'Showing saved descriptions.' : 'Showing live workflow guidance.';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    fetch('/api/operations/geai', { method: 'POST', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<GeaiBrief>; })
      .then(brief => { if (!controller.signal.aborted) { setResult({ revision, brief }); setLoading(false); } })
      .catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } });
    return () => controller.abort();
  }, [revision, requestId]);

  return <section className={`${s.panel} ${s.geai} ${loading ? s.geaiPreparing : ''}`} aria-labelledby={headingId} aria-busy={loading}>
    <div className={s.geaiHeading}><div><h2 id={headingId}><GeaiBrand active={loading} /></h2>
      <p className={s.geaiStatus}>{loading ? 'Loading your briefing…' : brief?.mode === 'ai' ? `AI descriptions · updated ${new Date(brief.generatedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : hasSavedDescriptions ? 'Saved descriptions · not AI-generated' : 'Live workspace snapshot'}</p></div>
      <button type="button" disabled={loading} onClick={() => setRequestId(id => id + 1)} aria-label="Refresh GEAI briefing">Refresh</button>
    </div>
    {loading && <div className={s.geaiSkeleton} aria-hidden="true"><span /><span /><span /><div><span /><span /></div></div>}
    <div className={s.geaiContent} aria-live="polite" aria-atomic="true">
      {!loading && brief && <div key={`${revision}-${requestId}`} className={s.geaiReveal}>
        <p className={s.geaiSummary}><span className="sr-only">{brief.summary}</span><span aria-hidden="true">{brief.summary.split(/\s+/).map((word, i) => <span key={i}><span className={s.geaiWord} style={{ animationDelay: `${Math.min(i * 18, 650)}ms` }}>{word}</span>{' '}</span>)}</span></p>
        <ul className={s.geaiPriorities}>{brief.priorities.map((item, i) => <li className={s.geaiPriority} style={{ animationDelay: `${200 + i * 110}ms` }} key={`${item.href}-${i}`}><Link href={item.href}><span className={s.geaiPriorityCopy}><span className={s.geaiPriorityTitle}>{item.text}</span><span className={s.geaiNextStep}><strong>{item.descriptionSource === 'ai' ? 'GEAI:' : item.descriptionSource === 'saved' ? 'Description:' : 'Next step:'}</strong> {item.description || item.nextStep || 'Open this item to review its details and available actions.'}</span></span><span aria-hidden="true">→</span></Link></li>)}</ul>
      </div>}
      {error && <p className={s.geaiNotice}>GEAI couldn’t update right now. Your workspace records are still available.</p>}
      {!loading && !error && brief?.mode === 'snapshot' && brief.priorities.length > 0 && <p className={s.geaiNotice}>{fallbackLabel}{' '}{brief.aiStatus === 'not_configured' ? 'GEAI background updates are not configured yet.' : brief.aiStatus === 'setup_required' ? 'GEAI’s cache needs database setup.' : brief.aiStatus === 'unavailable' ? 'GEAI’s background cache is temporarily unavailable.' : 'GEAI’s scheduled update is pending.'}</p>}
    </div>
    <div className={s.geaiFooter}><Link className={s.detailLink} href={brief?.workspaceHref ? `${brief.workspaceHref}?view=tasks` : '/account/redirect'}>Open workspace tasks →</Link></div>
  </section>;
}
